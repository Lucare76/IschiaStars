import assert from "node:assert/strict";
import { translateMissingTexts, TranslationError } from "../lib/server/deepl-translation";
async function main() {
  let calls = 0;
  const fake: typeof fetch = async (url, init) => {
    calls++;
    assert.equal(url, "https://api-free.deepl.com/v2/translate");
    assert.equal((init!.headers as Record<string,string>).Authorization, "DeepL-Auth-Key test:fx");
    const body = JSON.parse(init!.body as string);
    assert.equal(body.target_lang, "EN-GB");
    assert.deepEqual(body.ignore_tags, ["keep"]);
    assert.ok(body.text.length <= 50);
    return Response.json({ translations: body.text.map((text: string) => ({ text: text.replace("Acconto", "Deposit") })) });
  };
  assert.deepEqual(await translateMissingTexts([], undefined, fake), {});
  await assert.rejects(translateMissingTexts(["Acconto"], undefined, fake), (e: unknown) => e instanceof TranslationError && e.status === 503);
  assert.equal(calls, 0);
  const source = "Acconto 20% entro 31/12/2026: € 300,00 per {cliente}, https://ischiastars.it/a?a=1&b=2";
  const result = await translateMissingTexts([source, source], "test:fx", fake);
  assert.equal(result[source], source.replace("Acconto", "Deposit"));
  assert.equal(calls, 1);
  await translateMissingTexts(Array.from({length: 51}, (_, i) => "Acconto " + i), "test:fx", fake);
  assert.equal(calls, 3);
  for (const status of [403, 456, 429, 500]) {
    await assert.rejects(translateMissingTexts(["Acconto"], "secret", async () => new Response("secret", {status})), (e: unknown) => e instanceof TranslationError && !e.message.includes("secret"));
  }
  await assert.rejects(translateMissingTexts(["Acconto 20%"], "test", async () => Response.json({translations:[{text:'<text>Deposit <keep id="0">30%</keep></text>'}]})), TranslationError);
  await assert.rejects(translateMissingTexts(["Acconto"], "test", async () => Response.json({translations:[]})), TranslationError);
  await assert.rejects(translateMissingTexts(["x".repeat(12001)], "test", fake), TranslationError);
  await assert.rejects(translateMissingTexts(["Acconto"], "test", async () => {throw Error("secret")}), (e: unknown) => e instanceof TranslationError && e.status === 504);
  console.log("DeepL integration tests passed (mock provider; no billable requests).");
}
void main();
