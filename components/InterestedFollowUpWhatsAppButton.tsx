"use client";

import { useMemo, useState } from "react";
import { Quote } from "@/lib/types";
import { buildInterestedFollowUpMessage } from "@/lib/interested-follow-up-message";
import { normalizeItalianPhone } from "@/lib/utils";

export function InterestedFollowUpWhatsAppButton({ quote, hotelName, hotelGroup }: { quote: Quote; hotelName: string; hotelGroup?: number }) {
  const [copied, setCopied] = useState(false);
  const message = useMemo(() => buildInterestedFollowUpMessage(quote, hotelName, hotelGroup), [quote, hotelName, hotelGroup]);
  const chatUrl = `https://wa.me/${normalizeItalianPhone(quote.customerPhone)}`;

  async function handleClick() {
    await navigator.clipboard.writeText(message).catch(() => null);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
    window.open(chatUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <button
      className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:brightness-95"
      onClick={() => void handleClick()}
      type="button"
    >
      {copied ? "✓ Messaggio interesse copiato" : "Follow-up interesse WhatsApp"}
    </button>
  );
}
