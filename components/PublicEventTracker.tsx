"use client";

import { useEffect } from "react";
import { trackQuoteEvent } from "@/lib/client-tracking";

export function PublicEventTracker({ quoteCode, token }: { quoteCode: string; token: string }) {
  useEffect(() => {
    const key = `ischiastars:quote-opened:${quoteCode}:${token}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    trackQuoteEvent({ quoteCode, token }, "quote_opened", { source: "public_quote_page" });
  }, [quoteCode, token]);

  return null;
}
