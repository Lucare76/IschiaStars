"use client";

import { useState } from "react";
import { Quote } from "@/lib/types";
import { trackQuoteEvent } from "@/lib/client-tracking";
import { whatsappQuoteLink, whatsappQuoteMessage } from "@/lib/utils";

export function WhatsAppSendButton({ quote, label = "Invia su WhatsApp" }: { quote: Quote; label?: string }) {
  const href = whatsappQuoteLink(quote);
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    trackQuoteEvent({ quoteCode: quote.code, token: quote.token }, "whatsapp_clicked", { placement: "admin_quote_card" });
    await navigator.clipboard.writeText(whatsappQuoteMessage(quote)).catch(() => null);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
    window.open(href, "_blank", "noopener,noreferrer");
  }

  return (
    <button
      className="focus-ring rounded-full bg-ischia-leaf px-4 py-2 text-sm font-black text-white shadow-sm transition hover:brightness-95"
      onClick={() => void handleClick()}
      type="button"
    >
      {copied ? "✓ Testo copiato — incolla su WhatsApp" : label}
    </button>
  );
}
