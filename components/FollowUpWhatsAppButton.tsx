"use client";

import { useState } from "react";
import { adminApiFetch, adminApiHeaders, readAdminApiJson } from "@/lib/admin-api-client";
import { normalizeItalianPhone } from "@/lib/utils";

type FollowUpWhatsAppButtonProps = {
  message?: string;
  clientPhone?: string;
};

export function FollowUpWhatsAppButton({ message, clientPhone }: FollowUpWhatsAppButtonProps) {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  if (!message || !clientPhone) {
    return (
      <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-400 ring-1 ring-slate-200">
        Telefono assente
      </span>
    );
  }

  async function handleClick() {
    setLoading(true);
    setCopyFailed(false);
    let finalMessage = message!;

    try {
      const shortCode = extractShortCode(message!);
      if (shortCode) {
        const response = await adminApiFetch("/api/follow-up/render-message", {
          method: "POST",
          headers: adminApiHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ shortCode })
        });
        const payload = await readAdminApiJson<{ ok?: boolean; message?: string }>(response);
        if (response.ok && payload?.ok && payload.message?.trim()) {
          finalMessage = payload.message;
        }
      }
    } catch {
      // Mantiene il messaggio legacy come fallback: il follow-up non deve bloccarsi
      // se le impostazioni personalizzate non sono temporaneamente disponibili.
    }

    const didCopy = await copyToClipboard(finalMessage);
    setCopied(true);
    setCopyFailed(!didCopy);
    setTimeout(() => setCopied(false), 3000);
    window.open(buildWhatsAppUrl(clientPhone!, finalMessage), "_blank", "noopener,noreferrer");
    setLoading(false);
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        className="inline-flex h-9 items-center justify-center rounded-full bg-ischia-leaf px-3.5 text-center text-xs font-black text-white transition hover:bg-ischia-navy disabled:opacity-60"
        disabled={loading}
        onClick={() => void handleClick()}
        type="button"
      >
        {loading ? "Preparo messaggio..." : copied ? "✓ Messaggio pronto su WhatsApp" : "Scrivi su WhatsApp"}
      </button>
      {copyFailed ? (
        <span className="max-w-64 text-right text-[11px] font-bold leading-4 text-amber-700">
          Se WhatsApp non mostra il testo, copialo manualmente dal template.
        </span>
      ) : null}
    </span>
  );
}

function extractShortCode(message: string) {
  const match = message.match(/\/p\/([A-Za-z0-9_-]+)/);
  return match?.[1] ?? "";
}

function buildWhatsAppUrl(phone: string, message: string) {
  const normalizedPhone = normalizeItalianPhone(phone);
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${normalizedPhone}?text=${encodedMessage}`;
}

async function copyToClipboard(message: string) {
  if (!navigator.clipboard?.writeText) return false;
  return navigator.clipboard.writeText(message).then(() => true).catch(() => false);
}
