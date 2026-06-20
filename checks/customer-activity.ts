import assert from "node:assert/strict";
import { isCustomerActivityEvent } from "../lib/server/trackingFilters";
import type { QuoteEvent } from "../lib/types";

const event = (eventType: QuoteEvent["eventType"], metadata: Record<string, unknown> = {}): QuoteEvent => ({
  id: crypto.randomUUID(),
  quoteId: "quote-1",
  eventType,
  createdAt: new Date().toISOString(),
  metadata
});

assert.equal(isCustomerActivityEvent(event("quote_opened", { ip: "8.8.8.8" })), true);
assert.equal(isCustomerActivityEvent(event("details_opened", { ip: "8.8.8.8" })), true);
assert.equal(isCustomerActivityEvent(event("hotel_link_clicked", { ip: "8.8.8.8" })), true);
assert.equal(isCustomerActivityEvent(event("quote_opened", { ip: "93.148.93.103" })), false);
assert.equal(isCustomerActivityEvent(event("quote_opened", { excluded_from_tracking: true })), false);
assert.equal(isCustomerActivityEvent(event("whatsapp_clicked", { placement: "admin_quote_card" })), false);
assert.equal(isCustomerActivityEvent(event("follow_up_whatsapp_click", { source: "admin_follow_up" })), false);
assert.equal(isCustomerActivityEvent(event("quote_opened", { seed: true })), false);
assert.equal(isCustomerActivityEvent({
  ...event("quote_opened", { ip: "8.8.8.8" }),
  userAgent: "WhatsApp/2.24.7"
}), false);
assert.equal(isCustomerActivityEvent(event("quote_opened", {
  ip: "8.8.8.8",
  user_agent: "facebookexternalhit/1.1"
})), false);

console.log("customer activity filters: ok");
