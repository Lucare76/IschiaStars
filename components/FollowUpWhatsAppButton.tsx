"use client";

import { useState } from "react";
import type { FollowUpSegment } from "@/lib/repositories/followUp";
import { normalizeItalianPhone } from "@/lib/utils";

type FollowUpWhatsAppButtonProps = {
  message?: string;
  quoteCode: string;
  token: string;
  segment: FollowUpSegment;
  clientPhone?: string;
};

export function FollowUpWhatsAppButton({ message, quoteCode, token, segment, clientPhone }: FollowUpWhatsAppButtonProps) {
  const [copied, setCopied] = useState(false);

  if (!message || !clientPhone) {
    return (
      <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-400 ring-1 ring-slate-200">
        Telefono assente
      </span>
    );
  }

  async function handleClick() {
    fetch("/api/quote-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteCode,
        token,
        eventType: "follow_up_whatsapp_click",
        metadata: {
          action: "whatsapp",
          source: "admin_follow_up",
          segment,
          quote_code: quoteCode,
          client_phone: clientPhone
        }
      })
    }).catch(() => undefined);

    await navigator.clipboard.writeText(message!).catch(() => null);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
    window.open(`https://wa.me/${normalizeItalianPhone(clientPhone!)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <button
      className="inline-flex h-9 items-center justify-center rounded-full bg-ischia-leaf px-3.5 text-center text-xs font-black text-white transition hover:bg-ischia-navy"
      onClick={() => void handleClick()}
      type="button"
    >
      {copied ? "✓ Incolla il messaggio su WhatsApp" : "Scrivi su WhatsApp"}
    </button>
  );
}
