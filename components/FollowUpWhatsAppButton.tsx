"use client";

import type { FollowUpSegment } from "@/lib/repositories/followUp";

type FollowUpWhatsAppButtonProps = {
  href?: string;
  quoteCode: string;
  token: string;
  segment: FollowUpSegment;
  clientPhone?: string;
};

export function FollowUpWhatsAppButton({ href, quoteCode, token, segment, clientPhone }: FollowUpWhatsAppButtonProps) {
  if (!href || !clientPhone) {
    return (
      <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-400 ring-1 ring-slate-200">
        Telefono assente
      </span>
    );
  }

  const trackClick = () => {
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
  };

  return (
    <a
      className="inline-flex h-9 items-center justify-center rounded-full bg-ischia-leaf px-3.5 text-center text-xs font-black text-white transition hover:bg-ischia-navy"
      href={href}
      onClick={trackClick}
      rel="noreferrer"
      target="_blank"
    >
      Scrivi su WhatsApp
    </a>
  );
}
