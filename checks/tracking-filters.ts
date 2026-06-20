import assert from "node:assert/strict";
import {
  getRequestIp,
  getTrackingExcludedIps,
  isExcludedTrackingEvent,
  isLikelyBotUserAgent,
  isTrackingExcludedIp
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

console.log("tracking filters: ok");
