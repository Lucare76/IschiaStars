/** Server-side integration. The key is supplied by the authenticated API route. */
export class TranslationError extends Error {
  constructor(
    message: string,
    public readonly status = 502,
  ) {
    super(message);
  }
}
function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
function xmlDecode(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}
function protectedText(source: string) {
  const tokens: string[] = [];
  const tokenPattern =
    /https?:\/\/[^\s<>]+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|\{[^{}]+\}|\d+(?:[.,:/-]\d+)*(?:\s?%)?/g;
  let xml = "<text>";
  let offset = 0;
  for (const match of Array.from(source.matchAll(tokenPattern))) {
    xml += xmlEscape(source.slice(offset, match.index));
    xml += `<keep id="${tokens.length}">${xmlEscape(match[0])}</keep>`;
    tokens.push(match[0]);
    offset = match.index! + match[0].length;
  }
  xml += xmlEscape(source.slice(offset)) + "</text>";
  return { source, xml, tokens };
}
function restoreText(
  value: string,
  original: ReturnType<typeof protectedText>,
) {
  const seen = new Set<number>();
  const restored = value
    .replace(
      /<keep\b[^>]*\bid=["'](\d+)["'][^>]*>([\s\S]*?)<\/keep>/g,
      (_, index: string, text: string) => {
        const id = Number(index);
        if (
          seen.has(id) ||
          original.tokens[id] === undefined ||
          xmlDecode(text) !== original.tokens[id]
        )
          throw new TranslationError(
            "La traduzione ha modificato un importo o un riferimento: riprova o completa il testo manualmente.",
          );
        seen.add(id);
        return xmlEscape(original.tokens[id]);
      },
    )
    .replace(/^\s*<text>\s?/, "")
    .replace(/<\/text>\s*$/, "");
  if (seen.size !== original.tokens.length || /<\/?[a-z][^>]*>/i.test(restored))
    throw new TranslationError(
      "Risposta di traduzione non valida: nessun testo è stato salvato.",
    );
  const result = xmlDecode(restored).trim();
  if (!result || result.length > 18000)
    throw new TranslationError("Risposta di traduzione non valida.");
  return result;
}
export async function translateMissingTexts(
  texts: string[],
  apiKey: string | undefined,
  fetcher: typeof fetch = fetch,
): Promise<Record<string, string>> {
  if (!texts.length) return {};
  if (!apiKey?.trim())
    throw new TranslationError(
      "Traduzione automatica non attiva: configura DEEPL_API_KEY nelle variabili protette di Vercel.",
      503,
    );
  const unique = Array.from(
    new Set(texts.map((text) => text.trim()).filter(Boolean)),
  );
  if (
    unique.length > 200 ||
    unique.some((text) => text.length > 12000) ||
    unique.join("").length > 60000
  )
    throw new TranslationError(
      "Troppi testi in una sola traduzione. Traduci una parte dei testi prima di riprovare.",
      400,
    );
  const encoded = unique.map(protectedText);
  if (encoded.some((item) => Buffer.byteLength(JSON.stringify(item.xml), "utf8") > 90000))
    throw new TranslationError("Testo troppo complesso: dividilo in note più brevi.", 400);
  const batches: Array<typeof encoded> = [];
  let batch: typeof encoded = [];
  for (const text of encoded) {
    if (
      batch.length &&
      (batch.length === 50 ||
        Buffer.byteLength(
          JSON.stringify([...batch.map((item) => item.xml), text.xml]),
          "utf8",
        ) > 90000)
    ) {
      batches.push(batch);
      batch = [];
    }
    batch.push(text);
  }
  if (batch.length) batches.push(batch);
  const endpoint = apiKey.trim().endsWith(":fx")
    ? "https://api-free.deepl.com/v2/translate"
    : "https://api.deepl.com/v2/translate";
  const translated = await Promise.all(
    batches.map(async (items) => {
      let response: Response;
      try {
        response = await fetcher(endpoint, {
          method: "POST",
          headers: {
            Authorization: `DeepL-Auth-Key ${apiKey.trim()}`,
            "Content-Type": "application/json",
          },
          cache: "no-store",
          signal: AbortSignal.timeout(20000),
          body: JSON.stringify({
            text: items.map((item) => item.xml),
            source_lang: "IT",
            target_lang: "EN-GB",
            tag_handling: "xml",
            ignore_tags: ["keep"],
            preserve_formatting: true,
            context:
              "Customer holiday offers for Ischia, Italy. Translate faithfully, preserving all payment, cancellation and service conditions. Do not add new promises or services.",
          }),
        });
      } catch {
        throw new TranslationError(
          "Il servizio di traduzione non risponde. I testi già scritti sono stati mantenuti.",
          504,
        );
      }
      if (!response.ok) {
        const message =
          response.status === 403
            ? "Chiave DeepL non valida: verifica la configurazione su Vercel."
            : response.status === 456
              ? "Quota DeepL esaurita: verifica il tuo account prima di riprovare."
              : response.status === 429
                ? "DeepL è temporaneamente occupato. Riprova tra poco."
                : "Traduzione non riuscita. Nessun testo è stato salvato.";
        throw new TranslationError(
          message,
          response.status === 429 ? 429 : 502,
        );
      }
      const payload = (await response.json().catch(() => null)) as {
        translations?: Array<{ text?: unknown }>;
      } | null;
      if (
        !Array.isArray(payload?.translations) ||
        payload.translations.length !== items.length
      )
        throw new TranslationError(
          "Risposta incompleta dal servizio di traduzione.",
        );
      return items.map((item, index) => {
        const value = payload.translations![index]?.text;
        if (typeof value !== "string")
          throw new TranslationError(
            "Risposta incompleta dal servizio di traduzione.",
          );
        return [item.source, restoreText(value, item)] as const;
      });
    }),
  );
  return Object.fromEntries(translated.flat());
}
