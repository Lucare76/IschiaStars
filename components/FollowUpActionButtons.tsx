"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { adminApiErrorMessage, adminApiFetch, readAdminApiJson } from "@/lib/admin-api-client";

export function FollowUpActionButtons({ quoteId, isClosed = false }: { quoteId: string; isClosed?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"solicited" | "snoozed" | "closed" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function postAction(action: "solicited" | "snoozed" | "closed") {
    if (action === "solicited" && !window.confirm("Confermi di aver sollecitato questo cliente?")) {
      return;
    }
    if (action === "closed" && !window.confirm("Vuoi chiudere il follow-up per questo cliente?")) {
      return;
    }

    setLoading(action);
    setMessage(null);
    const snoozedUntil = action === "snoozed"
      ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      : undefined;

    const response = await adminApiFetch("/api/follow-up", {
      method: "POST",
      body: JSON.stringify({ quoteId, action, snoozedUntil })
    });
    const payload = await readAdminApiJson<{ ok?: boolean; error?: string }>(response);
    setLoading(null);

    if (!response.ok || !payload?.ok) {
      setMessage(adminApiErrorMessage(response, payload, "Follow-up non salvato."));
      return;
    }

    router.refresh();
  }

  return (
    <div className="contents">
      {!isClosed ? <button
        className="inline-flex h-9 items-center justify-center rounded-full bg-white px-3.5 text-center text-xs font-black text-ischia-navy ring-1 ring-ischia-blue/20 disabled:opacity-60"
        disabled={Boolean(loading)}
        onClick={() => void postAction("solicited")}
        type="button"
      >
        {loading === "solicited" ? "Salvataggio..." : "Segna sollecitato"}
      </button> : null}
      {!isClosed ? <button
        className="inline-flex h-9 items-center justify-center rounded-full bg-white px-3.5 text-center text-xs font-black text-amber-800 ring-1 ring-amber-200 disabled:opacity-60"
        disabled={Boolean(loading)}
        onClick={() => void postAction("snoozed")}
        type="button"
      >
        {loading === "snoozed" ? "Salvataggio..." : "Rimanda a domani"}
      </button> : null}
      {!isClosed ? <button
        className="inline-flex h-9 items-center justify-center rounded-full bg-white px-3.5 text-center text-xs font-black text-rose-700 ring-1 ring-rose-200 disabled:opacity-60"
        disabled={Boolean(loading)}
        onClick={() => void postAction("closed")}
        type="button"
      >
        {loading === "closed" ? "Salvataggio..." : "Chiudi follow-up"}
      </button> : null}
      {message ? <p className="basis-full text-xs font-semibold text-red-700">{message}</p> : null}
    </div>
  );
}
