"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminApiErrorMessage, adminApiFetch, readAdminApiJson } from "@/lib/admin-api-client";

export function InterestedFollowUpEmailButton({
  quoteId,
  clientEmail,
  hotelName
}: {
  quoteId: string;
  clientEmail?: string;
  hotelName: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  if (!clientEmail) {
    return (
      <span className="inline-flex h-9 items-center justify-center rounded-full bg-slate-100 px-3.5 text-center text-xs font-black text-slate-400 ring-1 ring-slate-200">
        Email cliente mancante
      </span>
    );
  }

  async function sendEmail() {
    if (!window.confirm(`Inviare l'email personalizzata per ${hotelName} a questo cliente?`)) return;

    setLoading(true);
    setMessage(null);
    const response = await adminApiFetch(`/api/quotes/${quoteId}/send-interested-follow-up-email`, {
      method: "POST",
      body: JSON.stringify({ hotelName })
    });
    const payload = await readAdminApiJson<{ ok?: boolean; error?: string }>(response);
    setLoading(false);

    if (!response.ok || !payload?.ok) {
      setMessage({ type: "error", text: adminApiErrorMessage(response, payload, "Errore invio email interesse struttura.") });
      return;
    }

    setMessage({ type: "ok", text: "Email interesse struttura inviata." });
    router.refresh();
  }

  return (
    <div className="contents">
      <button
        className="rounded-full bg-white px-4 py-2 text-sm font-black text-ischia-navy ring-1 ring-ischia-blue/20 transition hover:bg-ischia-mist disabled:opacity-60"
        disabled={loading}
        onClick={() => void sendEmail()}
        type="button"
      >
        {loading ? "Invio email..." : "Email interesse struttura"}
      </button>
      {message ? (
        <p className={`basis-full text-xs font-semibold ${message.type === "ok" ? "text-emerald-700" : "text-red-700"}`}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
