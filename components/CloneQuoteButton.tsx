"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminApiErrorMessage, adminApiFetch, readAdminApiJson } from "@/lib/admin-api-client";

export function CloneQuoteButton({ quoteId }: { quoteId: string }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  async function handleClone() {
    setLoading(true);
    setMessage(null);
    try {
      const response = await adminApiFetch(`/api/quotes/${quoteId}`, {
        method: "POST",
        body: JSON.stringify({ action: "duplicate" })
      });
      const result = await readAdminApiJson<{ ok?: boolean; data?: { code?: string }; error?: string }>(response);
      if (!response.ok || !result?.ok || !result.data?.code) {
        setMessage(adminApiErrorMessage(response, result, "Duplicazione non riuscita."));
        return;
      }
      router.push(`/admin/preventivi/${result.data.code}`);
      router.refresh();
    } catch {
      setMessage("Duplicazione non riuscita.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-2">
      <button
        className="rounded-full bg-white px-4 py-2 text-center text-sm font-bold text-ischia-navy ring-1 ring-ischia-blue/20 disabled:opacity-60"
        disabled={loading}
        onClick={() => void handleClone()}
        type="button"
      >
        {loading ? "Duplicando..." : "Duplica"}
      </button>
      {message ? <p className="text-center text-xs font-bold text-rose-700">{message}</p> : null}
    </div>
  );
}
