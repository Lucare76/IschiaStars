"use client";

import { useState } from "react";
import { Quote } from "@/lib/types";
import { trackQuoteEvent } from "@/lib/client-tracking";
import { whatsappQuoteLink, whatsappQuoteMessage } from "@/lib/utils";

export function WhatsAppSendButton({ quote, label = "Invia su WhatsApp" }: { quote: Quote; label?: string }) {
  const href = whatsappQuoteLink(quote);
  const [copied, setCopied] = useState(false);

  async function copyMessage() {
    await navigator.clipboard.writeText(whatsappQuoteMessage(quote));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex gap-2">
      <a
        className="focus-ring rounded-full bg-ischia-leaf px-4 py-2 text-sm font-black text-white shadow-sm transition hover:brightness-95"
        href={href}
        onClick={() => {
          trackQuoteEvent({ quoteCode: quote.code, token: quote.token }, "whatsapp_clicked", { placement: "admin_quote_card" });
        }}
        rel="noopener noreferrer"
        target="_blank"
      >
        {label}
      </a>
      <button
        className="focus-ring rounded-full bg-white px-4 py-2 text-sm font-black text-ischia-navy ring-1 ring-ischia-blue/20 transition hover:bg-ischia-mist"
        onClick={() => void copyMessage()}
        type="button"
      >
        {copied ? "✓ Copiato!" : "Copia testo"}
      </button>
    </div>
  );
}
