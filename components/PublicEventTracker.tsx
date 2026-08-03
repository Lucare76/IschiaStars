"use client";

import { useEffect } from "react";
import { trackQuoteEvent } from "@/lib/client-tracking";
import { safeLocalStorageGet, safeLocalStorageSet, safeRandomId } from "@/lib/safe-storage";

export function PublicEventTracker({ quoteCode, token, source }: { quoteCode: string; token: string; source?: string }) {
  useEffect(() => {
    // Tracking best-effort: qualunque errore (storage bloccato, crypto assente, ecc.)
    // viene contenuto qui e non deve mai far fallire il render del preventivo.
    try {
      const key = `ischiastars:quote-opened:${quoteCode}:${token}`;
      const lastTrackedAt = Number(safeLocalStorageGet(key) ?? 0);
      if (Date.now() - lastTrackedAt < 30 * 60 * 1000) return;

      const visitorKey = "ischiastars:quote-visitor-id";
      const visitorId = safeLocalStorageGet(visitorKey) ?? safeRandomId("visitor");
      safeLocalStorageSet(visitorKey, visitorId);
      safeLocalStorageSet(key, String(Date.now()));
      trackQuoteEvent({ quoteCode, token }, "quote_opened", {
        source: source === "email" ? "email_quote_link" : source === "whatsapp" ? "whatsapp_quote_link" : "public_quote_page",
        visitor_id: visitorId
      });
    } catch {
      // Nessun throw deve raggiungere React: se il tracking fallisce, il preventivo resta visibile.
    }
  }, [quoteCode, source, token]);

  return null;
}
