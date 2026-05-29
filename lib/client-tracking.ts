import { QuoteEvent } from "@/lib/types";

export type QuoteTrackingIdentity = {
  quoteCode: string;
  token: string;
};

export function trackQuoteEvent(identity: QuoteTrackingIdentity, eventType: QuoteEvent["eventType"], metadata: Record<string, unknown> = {}) {
  const payload = JSON.stringify({ ...identity, eventType, metadata });

  if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
    navigator.sendBeacon("/api/quote-events", new Blob([payload], { type: "application/json" }));
    return;
  }

  void fetch("/api/quote-events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true
  });
}
