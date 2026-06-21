import assert from "node:assert/strict";
import { adminQuoteWhatsappMessage } from "../lib/message-templates";
import { absoluteShortPublicQuoteUrl, publicQuoteUrl, shortPublicQuoteUrl } from "../lib/utils";
import type { Quote } from "../lib/types";

const quote = {
  code: "IS-2026-999",
  token: "tok-legacy-token-that-must-keep-working",
  publicShortCode: "a1b2c3d4e5f60718",
  customerFirstName: "Mario",
  arrivalDate: "2026-08-10",
  departureDate: "2026-08-17",
  adults: 2,
  children: []
} as unknown as Quote;

assert.equal(shortPublicQuoteUrl(quote), "/p/a1b2c3d4e5f60718");
assert.equal(publicQuoteUrl(quote), "/preventivi/IS-2026-999/tok-legacy-token-that-must-keep-working");
assert.match(absoluteShortPublicQuoteUrl(quote), /\/p\/a1b2c3d4e5f60718$/);
assert.doesNotMatch(absoluteShortPublicQuoteUrl(quote), /token|tok-|[?&]/);

const message = adminQuoteWhatsappMessage({
  quote,
  options: [],
  quoteUrl: "https://preventivi.ischiastars.it/p/a1b2c3d4e5f60718"
});
const linkLine = message.split("\n").find((line) => line.startsWith("https://"));
assert.equal(linkLine, "https://preventivi.ischiastars.it/p/a1b2c3d4e5f60718");
assert.ok(message.includes("Apri il link"));
assert.ok(!message.includes("Apri con Chrome"));
assert.ok(!message.includes("Apri con Safari"));

console.log("short quote link checks passed");
