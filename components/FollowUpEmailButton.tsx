"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminApiErrorMessage, adminApiFetch, readAdminApiJson } from "@/lib/admin-api-client";

type FollowUpEmailButtonProps = {
  quoteId: string;
  clientEmail?: string;
};

export function FollowUpEmailButton({ quoteId, clientEmail }: FollowUpEmailButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  if (!clientEmail) {
    return (
      <span
        className="inline-flex h-9 items-center justify-center rounded-full bg-slate-100 px-3.5 text-center text-xs font-black text-slate-400 ring-1 ring-slate-200"
        title="Email cliente mancante"
      >
        Email cliente mancante
      </span>
    );
  }

  async function sendFollowUpEmail() {
    if (!window.confirm("Confermi l'invio del follow-up via email a questo cliente?")) return;

    setLoading(true);
    setMessage(null);
    const response = await adminApiFetch(`/api/quotes/${quoteId}/send-follow-up-email`, { method: "POST" });
    const payload = await readAdminApiJson<{ ok?: boolean; error?: string }>(response);
    setLoading(false);

    if (!response.ok || !payload?.ok) {
      setMessage({ type: "error", text: adminApiErrorMessage(response, payload, "Errore invio follow-up email.") });
      return;
    }

    setMessage(null);
    router.refresh();
  }

  return (
    <div className="contents">
      <button
        className="inline-flex h-9 items-center justify-center rounded-full bg-white px-3.5 text-center text-xs font-black text-ischia-navy ring-1 ring-ischia-blue/20 disabled:opacity-60"
        disabled={loading}
        onClick={() => void sendFollowUpEmail()}
        type="button"
      >
        {loading ? "Invio..." : "Invia follow-up email"}
      </button>
      {message ? (
        <p className={`basis-full text-xs font-semibold ${message.type === "ok" ? "text-emerald-700" : "text-red-700"}`}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
