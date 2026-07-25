"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { adminApiErrorMessage, adminApiFetch, adminApiHeaders, readAdminApiJson } from "@/lib/admin-api-client";
import { useBackofficePolling } from "@/hooks/useBackofficePolling";
import { QuoteCard, QuoteStats } from "@/components/QuoteCard";
import { Quote } from "@/lib/types";

export function QuotesPageContent({
  quotes: initialQuotes,
  statsByQuote,
}: {
  quotes: Quote[];
  statsByQuote: Record<string, QuoteStats>;
}) {
  const router = useRouter();
  const [quotes, setQuotes] = useState(initialQuotes);
  const [message, setMessage] = useState<string | null>(null);

  useBackofficePolling(30_000);

  // Sync when server sends fresh data after router.refresh()
  useEffect(() => {
    setQuotes(initialQuotes);
  }, [initialQuotes]);

  const handleExcludeToggle = useCallback(
    async (quote: Quote) => {
      const next = !quote.excludedFromStats;
      if (next) {
        const ok = window.confirm(
          `Vuoi escludere il preventivo ${quote.code} dalle statistiche?\n\nNon verrà conteggiato nelle liste operative principali. Potrai reincluderlo dal filtro "Esclusi".`
        );
        if (!ok) return;
      }
      const response = await adminApiFetch(`/api/quotes/${quote.id}`, {
        method: "PATCH",
        headers: adminApiHeaders(),
        body: JSON.stringify({ excludedFromStats: next }),
      });
      const result = await readAdminApiJson<{ ok?: boolean; data?: Quote; error?: string }>(response);
      if (response.ok && result?.data) {
        setQuotes((current) => current.map((q) => (q.id === quote.id ? result.data! : q)));
        setMessage(next ? `${quote.code} escluso dalle statistiche.` : `${quote.code} reinclueso nelle statistiche.`);
        router.refresh();
      } else {
        setMessage(adminApiErrorMessage(response, result));
      }
    },
    [router]
  );

  const handleDelete = useCallback(
    async (quote: Quote) => {
      const ok = window.confirm(
        `Vuoi cancellare il preventivo ${quote.code}?\n\nVerrà nascosto dalle liste operative. Potrai ripristinarlo dal filtro "Cancellati".`
      );
      if (!ok) return;
      const response = await adminApiFetch(`/api/quotes/${quote.id}`, {
        method: "PATCH",
        headers: adminApiHeaders(),
        body: JSON.stringify({ softDelete: true }),
      });
      const result = await readAdminApiJson<{ ok?: boolean; data?: Quote; error?: string }>(response);
      if (response.ok && result?.data) {
        setQuotes((current) => current.map((q) => (q.id === quote.id ? result.data! : q)));
        setMessage(`Preventivo ${quote.code} cancellato.`);
        router.refresh();
      } else {
        setMessage(adminApiErrorMessage(response, result, "Cancellazione non riuscita."));
      }
    },
    [router]
  );

  const handleRestore = useCallback(
    async (quote: Quote) => {
      const response = await adminApiFetch(`/api/quotes/${quote.id}`, {
        method: "POST",
        headers: adminApiHeaders(),
        body: JSON.stringify({ action: "restore" }),
      });
      const result = await readAdminApiJson<{ ok?: boolean; data?: Quote; error?: string }>(response);
      if (response.ok && result?.data) {
        setQuotes((current) => current.map((q) => (q.id === quote.id ? result.data! : q)));
        setMessage(`Preventivo ${quote.code} ripristinato.`);
        router.refresh();
      } else {
        setMessage(adminApiErrorMessage(response, result, "Ripristino non riuscito."));
      }
    },
    [router]
  );

  if (!quotes.length) {
    return (
      <div className="rounded-2xl bg-white/90 p-6 text-sm font-semibold text-ischia-ink/65 shadow-soft">
        Nessun preventivo in questo filtro.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {message ? (
        <p className="rounded-xl bg-ischia-mist px-4 py-2 text-sm font-semibold text-ischia-navy">{message}</p>
      ) : null}
      {quotes.map((quote) => (
        <QuoteCard
          key={quote.id}
          quote={quote}
          stats={
            statsByQuote[quote.id] ?? {
              openings: 0,
              whatsappClicks: 0,
              confirmClicked: false,
              confirmed: false,
            }
          }
          actions={{
            onExcludeToggle: handleExcludeToggle,
            onDelete: handleDelete,
            onRestore: handleRestore,
          }}
        />
      ))}
    </div>
  );
}
