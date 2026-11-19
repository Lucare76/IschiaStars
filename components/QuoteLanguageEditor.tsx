"use client";
import { useState } from "react";
import type { Quote } from "@/lib/types";
import {
  missingEnglishTranslations,
  quoteEnglishSources,
  translateQuoteText,
  type QuoteLanguage,
} from "@/lib/i18n/quote-language";
import { adminApiFetch, readAdminApiJson } from "@/lib/admin-api-client";
export function QuoteLanguageEditor({
  quote,
  onSaved,
}: {
  quote: Quote;
  onSaved: (quote: Quote) => void;
}) {
  const [language, setLanguage] = useState<QuoteLanguage>(
    quote.language ?? "it",
  );
  const [translations, setTranslations] = useState(
    quote.englishTranslations ?? {},
  );
  const [customSource, setCustomSource] = useState("");
  const [customEnglish, setCustomEnglish] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const sources = Array.from(
    new Set([...quoteEnglishSources(quote), ...Object.keys(translations)]),
  );
  const missing = missingEnglishTranslations({
    ...quote,
    englishTranslations: translations,
  });
  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const response = await adminApiFetch(
        `/api/quotes/${quote.id}/localization`,
        { method: "PATCH", body: JSON.stringify({ language, translations }) },
      );
      const result = await readAdminApiJson<{
        ok?: boolean;
        quote?: Quote;
        error?: string;
      }>(response);
      if (!response.ok || !result?.ok || !result.quote)
        throw Error(result?.error ?? "Salvataggio non riuscito");
      onSaved(result.quote);
      setMessage("Lingua e traduzioni salvate.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Salvataggio non riuscito",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ischia-blue/15">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-black text-ischia-navy">
          Lingua cliente e versione inglese
        </h2>
        <select
          aria-label="Lingua cliente"
          value={language}
          onChange={(e) => setLanguage(e.target.value as QuoteLanguage)}
          className="rounded-xl border p-2"
        >
          <option value="it">Italiano</option>
          <option value="en">English</option>
        </select>
      </div>
      {language === "en" && (
        <>
          <p className="my-3 text-sm">
            Email, WhatsApp, pagina cliente e voucher saranno in inglese. I
            testi standard sono precompilati; completa e controlla gli altri
            prima dell’invio. I nomi degli hotel restano invariati.
          </p>
          <p
            className={
              missing.length
                ? "mb-3 font-bold text-amber-800"
                : "mb-3 font-bold text-emerald-800"
            }
          >
            {missing.length
              ? `${missing.length} testi da tradurre: invio inglese non ancora disponibile.`
              : "Tutti i testi hanno una versione inglese."}
          </p>
          <details>
            <summary className="cursor-pointer font-bold text-ischia-blue">
              Controlla / modifica traduzioni ({sources.length})
            </summary>
            <div className="mt-3 max-h-[520px] space-y-4 overflow-y-auto">
              {sources.map((source) => (
                <label
                  key={source}
                  className="block rounded-xl bg-ischia-mist p-3 text-sm"
                >
                  <span className="mb-2 block whitespace-pre-line">
                    {source}
                  </span>
                  <textarea
                    aria-label={`Traduzione: ${source}`}
                    rows={3}
                    className="w-full rounded-lg border p-2"
                    placeholder="Scrivi la traduzione inglese"
                    value={
                      translations[source] ?? translateQuoteText(source) ?? ""
                    }
                    onChange={(e) =>
                      setTranslations((current) => ({
                        ...current,
                        [source]: e.target.value,
                      }))
                    }
                  />
                </label>
              ))}
            </div>
          </details>
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-bold text-ischia-blue">
              Prepara una nota aggiuntiva in inglese
            </summary>
            <div className="mt-2 grid gap-2">
              <label className="text-sm">
                Nota originale
                <textarea
                  value={customSource}
                  onChange={(e) => setCustomSource(e.target.value)}
                  className="mt-1 w-full rounded-lg border p-2"
                />
              </label>
              <label className="text-sm">
                Versione inglese
                <textarea
                  value={customEnglish}
                  onChange={(e) => setCustomEnglish(e.target.value)}
                  className="mt-1 w-full rounded-lg border p-2"
                />
              </label>
              <button
                type="button"
                disabled={!customSource.trim() || !customEnglish.trim()}
                className="justify-self-start rounded-full border px-3 py-2 text-sm disabled:opacity-50"
                onClick={() => {
                  setTranslations((current) => ({
                    ...current,
                    [customSource.trim()]: customEnglish.trim(),
                  }));
                  setCustomSource("");
                  setCustomEnglish("");
                }}
              >
                Aggiungi alle traduzioni da salvare
              </button>
            </div>
          </details>
        </>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => void save()}
        className="mt-4 rounded-full bg-ischia-navy px-5 py-2 text-sm font-bold text-white disabled:opacity-50"
      >
        {busy ? "Salvataggio…" : "Salva lingua e traduzioni"}
      </button>
      {message && (
        <p role="status" className="mt-2 text-sm">
          {message}
        </p>
      )}
    </section>
  );
}
