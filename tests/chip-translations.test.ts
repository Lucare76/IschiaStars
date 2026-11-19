import assert from "node:assert/strict";
import configured from "./fixtures/configured-chips.json";
import { defaultQuoteChipSettings } from "../lib/quote-chip-settings";
import { translateQuoteText } from "../lib/i18n/quote-language";
const sources: string[] = [];
for (const settings of [configured, defaultQuoteChipSettings]) {
  for (const list of Object.values(settings)) {
    if (Array.isArray(list)) for (const item of list) sources.push(typeof item === "string" ? item : item.label);
  }
}
const unique = [...new Set(sources)];
const missing = unique.filter(source => translateQuoteText(source) === undefined);
assert.deepEqual(missing, []);
for (const source of unique) {
  assert.equal(translateQuoteText(source, {[source]:"My correction"}), "My correction");
  assert.ok(translateQuoteText(source)!.trim());
}
assert.equal(translateQuoteText("Nota nuova non preimpostata"), undefined);
console.log(unique.length + " configured/default chip texts covered without API requests.");
