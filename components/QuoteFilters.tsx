"use client";

import { useMemo, useState } from "react";
import { adminApiHeaders } from "@/lib/admin-api-client";
import { QuoteCard, QuoteCardActions, QuoteStats } from "@/components/QuoteCard";
import { Quote } from "@/lib/types";

type QuoteFilter =
  | "attivi"
  | "tutti"
  | "cancellati"
  | "esclusi"
  | "preventivo_inviato"
  | "alternative"
  | "confermati"
  | "aperti"
  | "click_whatsapp"
  | "perso_non_disponibile";

export function QuoteFilters({
  quotes: initialQuotes,
  statsByQuote,
  initialFilter = "attivi"
}: {
  quotes: Quote[];
  statsByQuote: Record<string, QuoteStats>;
  initialFilter?: QuoteFilter;
}) {
  const [quotes, setQuotes] = useState(initialQuotes);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<QuoteFilter>(initialFilter);
  const [message, setMessage] = useState<string | null>(null);

  const filtered = useMemo(() => quotes.filter((quote) => {
    const stats = statsByQuote[quote.id];
    const haystack = `${quote.customerFirstName} ${quote.customerLastName} ${quote.code} ${quote.proposedHotel.name}`.toLowerCase();
    const matchesSearch = haystack.includes(query.toLowerCase());
    const isDeleted = Boolean(quote.deletedAt);

    const matchesFilter =
      (filter === "attivi" && !isDeleted && !quote.excludedFromStats) ||
      (filter === "tutti" && !isDeleted) ||
      (filter === "cancellati" && isDeleted) ||
      (filter === "esclusi" && quote.excludedFromStats && !isDeleted) ||
      (filter === "preventivo_inviato" && !isDeleted && quote.status === filter) ||
      (filter === "alternative" && !isDeleted && quote.isAlternative) ||
      (filter === "confermati" && !isDeleted && (quote.status === "confermato" || stats?.confirmed)) ||
      (filter === "aperti" && !isDeleted && Boolean(stats?.openings) && quote.status !== "confermato" && !stats?.confirmed) ||
      (filter === "click_whatsapp" && !isDeleted && Boolean(stats?.whatsappClicks)) ||
      (filter === "perso_non_disponibile" && !isDeleted && quote.status === filter);

    return matchesSearch && matchesFilter;
  }), [filter, query, quotes, statsByQuote]);

  async function handleExcludeToggle(quote: Quote) {
    const next = !quote.excludedFromStats;
    const response = await fetch(`/api/quotes/${quote.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: adminApiHeaders(),
      body: JSON.stringify({ excludedFromStats: next })
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; data?: Quote } | null;
    if (response.ok && result?.data) {
      setQuotes((current) => current.map((q) => (q.id === quote.id ? result.data! : q)));
      setMessage(next ? `${quote.code} escluso dalle statistiche.` : `${quote.code} reinclueso nelle statistiche.`);
    } else {
      setMessage("Operazione non riuscita.");
    }
  }

  async function handleDelete(quote: Quote) {
    const ok = window.confirm(
      `Vuoi cancellare il preventivo ${quote.code}?\n\nVerrà nascosto dalle liste operative e dalle statistiche. Potrai ripristinarlo dal filtro "Cancellati".`
    );
    if (!ok) return;

    const response = await fetch(`/api/quotes/${quote.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: adminApiHeaders(),
      body: JSON.stringify({ softDelete: true })
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; data?: Quote } | null;
    if (response.ok && result?.data) {
      setQuotes((current) => current.map((q) => (q.id === quote.id ? result.data! : q)));
      setMessage(`Preventivo ${quote.code} cancellato.`);
    } else {
      setMessage("Cancellazione non riuscita.");
    }
  }

  async function handleRestore(quote: Quote) {
    const response = await fetch(`/api/quotes/${quote.id}`, {
      method: "POST",
      credentials: "include",
      headers: adminApiHeaders(),
      body: JSON.stringify({ action: "restore" })
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; data?: Quote } | null;
    if (response.ok && result?.data) {
      setQuotes((current) => current.map((q) => (q.id === quote.id ? result.data! : q)));
      setMessage(`Preventivo ${quote.code} ripristinato.`);
    } else {
      setMessage("Ripristino non riuscito.");
    }
  }

  const actions: QuoteCardActions = {
    onExcludeToggle: handleExcludeToggle,
    onDelete: handleDelete,
    onRestore: handleRestore
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-white/90 p-4 shadow-soft">
        {message ? (
          <p className="mb-3 rounded-xl bg-ischia-mist px-4 py-2 text-sm font-semibold text-ischia-navy">{message}</p>
        ) : null}
        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <input
            className="w-full rounded-xl border border-ischia-blue/20 px-4 py-3 text-sm"
            placeholder="Cerca cliente, codice o hotel"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <select
            className="rounded-xl border border-ischia-blue/20 px-4 py-3 text-sm font-semibold text-ischia-navy"
            value={filter}
            onChange={(event) => setFilter(event.target.value as QuoteFilter)}
          >
            <option value="attivi">Attivi</option>
            <option value="tutti">Tutti (non cancellati)</option>
            <option value="preventivo_inviato">Inviati</option>
            <option value="alternative">Alternative</option>
            <option value="confermati">Confermati</option>
            <option value="aperti">Aperti</option>
            <option value="click_whatsapp">Click WhatsApp</option>
            <option value="perso_non_disponibile">Persi</option>
            <option value="esclusi">Esclusi dalle statistiche</option>
            <option value="cancellati">Cancellati</option>
          </select>
        </div>
      </div>

      {filtered.length
        ? filtered.map((quote) => (
            <QuoteCard key={quote.id} quote={quote} stats={statsByQuote[quote.id]} actions={actions} />
          ))
        : (
            <div className="rounded-2xl bg-white/90 p-6 text-sm font-semibold text-ischia-ink/65 shadow-soft">
              Nessun preventivo corrisponde ai filtri selezionati.
            </div>
          )}
    </div>
  );
}
