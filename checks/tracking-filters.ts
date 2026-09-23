import assert from "node:assert/strict";
import {
  getRequestIp,
  getTrackingExcludedIps,
  hasClientVisitorId,
  isCustomerActivityEvent,
  isExcludedTrackingEvent,
  isLikelyBotUserAgent,
  isTrackingExcludedIp,
  shouldIgnoreBotTracking
} from "../lib/server/trackingFilters";

assert.ok(getTrackingExcludedIps().includes("93.148.93.103"));
assert.equal(isTrackingExcludedIp("93.148.93.103"), true);
assert.equal(isTrackingExcludedIp("8.8.8.8"), false);

assert.equal(getRequestIp(new Headers({
  "x-forwarded-for": "not-an-ip, 93.148.93.103, 8.8.8.8"
})), "93.148.93.103");
assert.equal(getRequestIp(new Headers({
  "cf-connecting-ip": "8.8.4.4",
  "x-forwarded-for": "93.148.93.103"
})), "8.8.4.4");
assert.equal(getRequestIp(new Headers({
  "x-real-ip": "::ffff:93.148.93.103"
})), "93.148.93.103");

assert.equal(isExcludedTrackingEvent({ metadata: { ip: "93.148.93.103" } }), true);
assert.equal(isExcludedTrackingEvent({ metadata: { excluded_from_tracking: true } }), true);
assert.equal(isExcludedTrackingEvent({ metadata: { ip: "8.8.8.8", excluded_from_tracking: false } }), false);

assert.equal(isLikelyBotUserAgent("WhatsApp/2.24.7"), true);
assert.equal(isLikelyBotUserAgent("facebookexternalhit/1.1"), true);
assert.equal(isLikelyBotUserAgent("Mozilla/5.0 Chrome/125 Safari/537.36"), false);

assert.equal(hasClientVisitorId({ visitor_id: "visitor-12345678" }), true);
assert.equal(hasClientVisitorId({}), false);
assert.equal(shouldIgnoreBotTracking("WhatsApp/2.24.7", {}), true);
assert.equal(shouldIgnoreBotTracking("WhatsApp/2.24.7", { visitor_id: "visitor-12345678" }), false);
assert.equal(shouldIgnoreBotTracking("facebookexternalhit/1.1", {}), true);

assert.equal(isCustomerActivityEvent({
  id: "evt-whatsapp-client",
  quoteId: "quote-1",
  eventType: "quote_opened",
  createdAt: new Date().toISOString(),
  userAgent: "WhatsApp/2.24.7",
  metadata: { visitor_id: "visitor-12345678", ip: "8.8.8.8" }
}), true);

assert.equal(isCustomerActivityEvent({
  id: "evt-whatsapp-preview",
  quoteId: "quote-1",
  eventType: "quote_opened",
  createdAt: new Date().toISOString(),
  userAgent: "WhatsApp/2.24.7",
  metadata: { ip: "8.8.8.8" }
}), false);

console.log("tracking filters: ok");
