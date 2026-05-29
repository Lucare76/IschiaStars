"use client";

import { Quote } from "@/lib/types";
import { trackQuoteEvent } from "@/lib/client-tracking";
import { whatsappQuoteLink } from "@/lib/utils";

export function WhatsAppSendButton({ quote, label = "Invia su WhatsApp" }: { quote: Quote; label?: string }) {
  const href = whatsappQuoteLink(quote);

  return (
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
  );
}
