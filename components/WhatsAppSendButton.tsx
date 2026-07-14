"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Quote } from "@/lib/types";
import { trackQuoteEvent } from "@/lib/client-tracking";
import { adminApiFetch, readAdminApiJson } from "@/lib/admin-api-client";
import { normalizeItalianPhone, whatsappQuoteMessage } from "@/lib/utils";

export function WhatsAppSendButton({ quote, label = "Invia su WhatsApp" }: { quote: Quote; label?: string }) {
  const router = useRouter();
  const chatUrl = `https://wa.me/${normalizeItalianPhone(quote.customerPhone)}`;
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    trackQuoteEvent({ quoteCode: quote.code, token: quote.token }, "whatsapp_clicked", { placement: "admin_quote_card" });
    let message = "";
    try {
      message = whatsappQuoteMessage(quote);
    } catch (err) {
      console.error("[WhatsAppSendButton] failed to build message:", err);
    }
    if (message) await navigator.clipboard.writeText(message).catch(() => null);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
    window.open(chatUrl, "_blank", "noopener,noreferrer");

    if (quote.status === "in_lavorazione") {
      const response = await adminApiFetch(`/api/quotes/${quote.id}`, {
        method: "POST",
        body: JSON.stringify({ action: "mark_sent" })
      }).catch(() => null);
      if (response?.ok) {
        const result = await readAdminApiJson<{ ok?: boolean; data?: Quote }>(response);
        window.dispatchEvent(new CustomEvent("ischiastars:quote-updated", { detail: { quote: result?.data ?? null, quoteId: quote.id } }));
        router.refresh();
      }
    }
  }

  return (
    <button
      className="focus-ring rounded-full bg-ischia-leaf px-4 py-2 text-center text-sm font-black text-white shadow-sm transition hover:brightness-95"
      onClick={() => void handleClick()}
      type="button"
    >
      {copied ? "✓ Incolla il messaggio su WhatsApp" : label}
    </button>
  );
}
