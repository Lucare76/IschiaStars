"use client";

import { useMemo, useState } from "react";
import { QuoteCard, QuoteStats } from "@/components/QuoteCard";
import { Quote } from "@/lib/types";

export function QuoteFilters({ quotes, statsByQuote }: { quotes: Quote[]; statsByQuote: Record<string, QuoteStats> }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("tutti");

  const filtered = useMemo(() => quotes.filter((quote) => {
    const stats = statsByQuote[quote.id];
    const haystack = `${quote.customerFirstName} ${quote.customerLastName} ${quote.code} ${quote.proposedHotel.name}`.toLowerCase();
    const matchesSearch = haystack.includes(query.toLowerCase());
    const matchesFilter =
      filter === "tutti" ||
      quote.status === filter ||
      (filter === "alternative" && quote.isAlternative) ||
      (filter === "confermati" && (quote.status === "confermato" || stats?.confirmed)) ||
      (filter === "aperti" && Boolean(stats?.openings) && quote.status !== "confermato" && !stats?.confirmed);
    return matchesSearch && matchesFilter;
  }), [filter, query, quotes, statsByQuote]);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-white/90 p-4 shadow-soft">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <input className="w-full rounded-xl border border-ischia-blue/20 px-4 py-3 text-sm" placeholder="Cerca cliente, codice o hotel" value={query} onChange={(event) => setQuery(event.target.value)} />
          <select className="rounded-xl border border-ischia-blue/20 px-4 py-3 text-sm font-semibold text-ischia-navy" value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="tutti">Tutti</option>
            <option value="preventivo_inviato">Inviati</option>
            <option value="alternative">Alternative</option>
            <option value="confermati">Confermati</option>
            <option value="aperti">Aperti</option>
            <option value="perso_non_disponibile">Persi</option>
          </select>
        </div>
      </div>

      {filtered.length ? filtered.map((quote) => <QuoteCard key={quote.id} quote={quote} stats={statsByQuote[quote.id]} />) : <div className="rounded-2xl bg-white/90 p-6 text-sm font-semibold text-ischia-ink/65 shadow-soft">Nessun preventivo corrisponde ai filtri selezionati.</div>}
    </div>
  );
}
