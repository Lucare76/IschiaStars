"use client";

import { useEffect } from "react";
import { trackQuoteEvent } from "@/lib/client-tracking";

export function PublicEventTracker({ quoteCode, token }: { quoteCode: string; token: string }) {
  useEffect(() => {
    const key = `ischiastars:quote-opened:${quoteCode}:${token}`;
    const lastTrackedAt = Number(localStorage.getItem(key) ?? 0);
    if (Date.now() - lastTrackedAt < 30 * 60 * 1000) return;

    const visitorKey = "ischiastars:quote-visitor-id";
    const visitorId = localStorage.getItem(visitorKey) ?? crypto.randomUUID();
    localStorage.setItem(visitorKey, visitorId);
    localStorage.setItem(key, String(Date.now()));
    trackQuoteEvent({ quoteCode, token }, "quote_opened", {
      source: "public_quote_page",
      visitor_id: visitorId
    });
  }, [quoteCode, token]);

  return null;
}
