"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { adminApiErrorMessage, adminApiFetch, readAdminApiJson } from "@/lib/admin-api-client";

type PollEmailResponse = {
  ok?: boolean;
  processed?: number;
  imported?: number;
  skipped?: number;
  message?: string;
  cooldownRemainingSeconds?: number;
  error?: string;
};

const CLIENT_COOLDOWN_SECONDS = 60;

export function PollEmailNowButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const disabled = loading || cooldown > 0;

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function handleClick() {
    setLoading(true);
    setMessage("Controllo in corso...");

    const response = await adminApiFetch("/api/admin/poll-email-now", { method: "POST" });
    const payload = await readAdminApiJson<PollEmailResponse>(response);
    setLoading(false);

    if (!response.ok || !payload?.ok) {
      if (response.status === 429 && payload?.cooldownRemainingSeconds) {
        setCooldown(payload.cooldownRemainingSeconds);
        setMessage(payload.message ?? "Controllo già eseguito da poco.");
        return;
      }
      setMessage(adminApiErrorMessage(response, payload, "Errore durante il controllo email"));
      return;
    }

    setCooldown(CLIENT_COOLDOWN_SECONDS);
    if ((payload.imported ?? 0) > 0) {
      setMessage(`Controllo completato: ${payload.imported} nuove email importate.`);
      router.refresh();
      return;
    }
    setMessage(payload.message ?? "Nessuna nuova email trovata");
  }

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <button
        className="rounded-full border border-ischia-blue/25 bg-white px-5 py-3 text-sm font-black text-ischia-navy shadow-sm transition hover:bg-ischia-mist disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled}
        onClick={() => void handleClick()}
        type="button"
      >
        {loading ? "Controllo in corso..." : cooldown > 0 ? `Riprova tra ${cooldown}s` : "Controlla email ora"}
      </button>
      {message ? <p className="max-w-xs text-xs font-semibold text-ischia-ink/65 sm:text-right">{message}</p> : null}
    </div>
  );
}
