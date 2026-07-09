import { QuoteEvent } from "@/lib/types";

export type QuoteTrackingIdentity = {
  quoteCode: string;
  token: string;
};

function getVisitorId() {
  if (typeof localStorage === "undefined" || typeof crypto === "undefined") return undefined;
  const visitorKey = "ischiastars:quote-visitor-id";
  const visitorId = localStorage.getItem(visitorKey) ?? crypto.randomUUID();
  localStorage.setItem(visitorKey, visitorId);
  return visitorId;
}

export function trackQuoteEvent(identity: QuoteTrackingIdentity, eventType: QuoteEvent["eventType"], metadata: Record<string, unknown> = {}) {
  const payload = JSON.stringify({
    ...identity,
    eventType,
    metadata: {
      ...metadata,
      visitor_id: typeof metadata.visitor_id === "string" ? metadata.visitor_id : getVisitorId()
    }
  });

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
