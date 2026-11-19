"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Quote } from "@/lib/types";
import { trackQuoteEvent } from "@/lib/client-tracking";
import { adminApiFetch, readAdminApiJson } from "@/lib/admin-api-client";
import { normalizeQuotePhone, whatsappQuoteMessage } from "@/lib/utils";

export function WhatsAppSendButton({ quote, label = "Invia su WhatsApp" }: { quote: Quote; label?: string }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  async function handleClick() {
    trackQuoteEvent({ quoteCode: quote.code, token: quote.token }, "whatsapp_clicked", { placement: "admin_quote_card" });
    setError("");
    let phone = "";
    let message = "";
    try {
      message = whatsappQuoteMessage(quote);
      phone = normalizeQuotePhone(quote);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Messaggio non disponibile");
      return;
    }
    if (message) await copyToClipboard(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 4000);
    window.open(`https://wa.me/${phone}`, "_blank", "noopener,noreferrer");

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
    <span><button
      className="focus-ring rounded-full bg-ischia-leaf px-4 py-2 text-center text-sm font-black text-white shadow-sm transition hover:brightness-95"
      onClick={() => void handleClick()}
      type="button"
    >
      {copied ? "✓ Copiato: incolla su WhatsApp" : label}
    </button>{error ? <span role="alert" className="mt-1 block text-xs text-rose-700">{error}</span> : null}</span>
  );
}

async function copyToClipboard(message: string) {
  if (!navigator.clipboard?.writeText) return false;
  return navigator.clipboard.writeText(message).then(() => true).catch(() => false);
}
