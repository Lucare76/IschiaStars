"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminApiHeaders } from "@/lib/admin-api-client";

export function CloneQuoteButton({ quoteId }: { quoteId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleClone() {
    setLoading(true);
    const response = await fetch(`/api/quotes/${quoteId}`, {
      method: "POST",
      headers: adminApiHeaders(),
      body: JSON.stringify({ action: "duplicate" })
    });
    const result = await response.json().catch(() => null) as { ok?: boolean; data?: { code?: string } } | null;
    setLoading(false);
    if (result?.ok && result.data?.code) {
      router.push(`/admin/preventivi/${result.data.code}`);
    }
  }

  return (
    <button
      className="rounded-full bg-white px-4 py-2 text-center text-sm font-bold text-ischia-navy ring-1 ring-ischia-blue/20 disabled:opacity-60"
      disabled={loading}
      onClick={() => void handleClone()}
      type="button"
    >
      {loading ? "Duplicando..." : "Duplica"}
    </button>
  );
}
