import { QuoteEvent } from "@/lib/types";
import { safeLocalStorageGet, safeLocalStorageSet, safeRandomId } from "@/lib/safe-storage";

export type QuoteTrackingIdentity = {
  quoteCode: string;
  token: string;
};

function getVisitorId(): string {
  try {
    const visitorKey = "ischiastars:quote-visitor-id";
    const existing = safeLocalStorageGet(visitorKey);
    if (existing) return existing;
    const visitorId = safeRandomId("visitor");
    safeLocalStorageSet(visitorKey, visitorId);
    return visitorId;
  } catch {
    // Storage/crypto non disponibili: id volatile solo per questo evento, mai un throw.
    return safeRandomId("visitor");
  }
}

// Tracking apertura/interazione preventivo: sempre best-effort e fire-and-forget.
// Nessun errore qui deve mai propagarsi al chiamante o bloccare l'interfaccia.
export function trackQuoteEvent(identity: QuoteTrackingIdentity, eventType: QuoteEvent["eventType"], metadata: Record<string, unknown> = {}) {
  try {
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

    if (typeof fetch === "function") {
      void fetch("/api/quote-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true
      }).catch(() => {
        // Fallimento di rete ignorato volontariamente: il tracking non deve bloccare l'utente.
      });
    }
  } catch {
    // Nessun throw deve mai raggiungere il chiamante: il preventivo resta visibile in ogni caso.
  }
}
