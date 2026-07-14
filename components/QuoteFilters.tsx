"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { adminApiErrorMessage, adminApiFetch, adminApiHeaders, readAdminApiJson } from "@/lib/admin-api-client";
import { useBackofficePolling } from "@/hooks/useBackofficePolling";
import { QuoteCard, QuoteCardActions, QuoteStats } from "@/components/QuoteCard";
import { isStayExpiredRome } from "@/lib/date-format";
import { hasReliableQuoteTracking } from "@/lib/follow-up-policy";
import { Quote } from "@/lib/types";

type QuoteFilter =
  | "evasi"
  | "attivi"
  | "scaduti"
  | "tutti"
  | "cancellati"
  | "esclusi"
  | "preventivo_inviato"
  | "alternative"
  | "confermati"
  | "aperti"
  | "non_aperti"
  | "click_whatsapp"
  | "perso_non_disponibile";

export function QuoteFilters({
  quotes: initialQuotes,
  statsByQuote,
  initialFilter = "evasi"
}: {
  quotes: Quote[];
  statsByQuote: Record<string, QuoteStats>;
  initialFilter?: QuoteFilter;
}) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [quotes, setQuotes] = useState(initialQuotes);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<QuoteFilter>(initialFilter);
  const [sort, setSort] = useState<"date_desc" | "date_asc" | "lastname" | "price" | "arrival">("date_desc");
  const [message, setMessage] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState(() => formatTime(new Date()));

  useEffect(() => {
    setQuotes(initialQuotes);
  }, [initialQuotes]);

  const fetchQuotes = useCallback(async (opts: { cancelled?: { value: boolean }; showSpinner?: boolean } = {}) => {
    if (opts.showSpinner) setRefreshing(true);
    const response = await adminApiFetch("/api/quotes?include_deleted=true");
    const result = await readAdminApiJson<{ ok?: boolean; source?: string; data?: Quote[]; error?: string }>(response);
    if (opts.cancelled?.value) return;
    if (opts.showSpinner) setRefreshing(false);
    if (!response.ok || !result?.ok || !Array.isArray(result.data)) return;
    setQuotes(result.data);
    setLastUpdated(formatTime(new Date()));
    if (result.source !== "supabase") {
      setMessage(result.error ?? "Dati non disponibili. Verifica la connessione o riprova più tardi.");
    }
  }, []);

  useEffect(() => {
    const cancelled = { value: false };
    void fetchQuotes({ cancelled });
    return () => { cancelled.value = true; };
  }, [fetchQuotes]);

  useEffect(() => {
    const handleQuoteUpdated = (event: Event) => {
      const updatedQuote = (event as CustomEvent<{ quote?: Quote | null; quoteId?: string }>).detail?.quote;
      if (updatedQuote?.id) {
        setQuotes((current) => current.map((quote) => (quote.id === updatedQuote.id ? updatedQuote : quote)));
      }
      void fetchQuotes();
      router.refresh();
    };

    window.addEventListener("ischiastars:quote-updated", handleQuoteUpdated);
    return () => window.removeEventListener("ischiastars:quote-updated", handleQuoteUpdated);
  }, [fetchQuotes, router]);

  useBackofficePolling(30_000);

  const handleRefresh = useCallback(() => {
    void fetchQuotes({ showSpinner: true });
  }, [fetchQuotes]);

  useEffect(() => {
    setFilter(initialFilter);
  }, [initialFilter]);

  const filtered = useMemo(() => quotes.filter((quote) => {
    const stats = statsByQuote[quote.id];
    const isConfirmed = quote.status === "confermato" || Boolean(quote.confirmation) || Boolean(stats?.confirmed);
    const haystack = [
      quote.code,
      quote.customerFirstName,
      quote.customerLastName,
      quote.customerEmail,
      quote.customerPhone,
      quote.requestedHotel,
      quote.proposedHotel.name,
      quote.alternativeHotel?.name,
      quote.treatment,
      ...quote.hotelOptions.flatMap((option) => [
        option.hotelName,
        option.hotelLocation,
        option.breakfastLabel,
        option.halfBoardLabel,
        option.fullBoardLabel,
        option.treatments.map((treatment) => treatment.label).join(" ")
      ])
    ].filter(Boolean).join(" ").toLowerCase();
    const normalizedQuery = query.trim().toLowerCase();
    const matchesSearch = !normalizedQuery || haystack.includes(normalizedQuery);
    const isDeleted = Boolean(quote.deletedAt);
    const isExpired = isStayExpiredRome(quote.departureDate);
    const hasReliableTracking = hasReliableQuoteTracking(quote.sentAt ?? quote.createdAt);

    const matchesFilter =
      ((filter === "evasi" || filter === "attivi") && !isDeleted && !quote.excludedFromStats && !isConfirmed && !isExpired && quote.status === "preventivo_inviato") ||
      (filter === "scaduti" && !isDeleted && !quote.excludedFromStats && !isConfirmed && isExpired && quote.status === "preventivo_inviato") ||
      (filter === "tutti" && !isDeleted) ||
      (filter === "cancellati" && isDeleted) ||
      (filter === "esclusi" && quote.excludedFromStats && !isDeleted) ||
      (filter === "preventivo_inviato" && !isDeleted && !quote.excludedFromStats && quote.status === filter) ||
      (filter === "alternative" && !isDeleted && !quote.excludedFromStats && quote.isAlternative) ||
      (filter === "confermati" && !isDeleted && !quote.excludedFromStats && isConfirmed) ||
      (filter === "aperti" && !isDeleted && !quote.excludedFromStats && Boolean(stats?.openings) && !isConfirmed && quote.status === "preventivo_inviato") ||
      (filter === "non_aperti" && !isDeleted && !quote.excludedFromStats && hasReliableTracking && !stats?.openings && !isConfirmed && quote.status === "preventivo_inviato") ||
      (filter === "click_whatsapp" && !isDeleted && !quote.excludedFromStats && Boolean(stats?.whatsappClicks)) ||
      (filter === "perso_non_disponibile" && !isDeleted && !quote.excludedFromStats && quote.status === filter);

    return matchesSearch && matchesFilter;
  }), [filter, query, quotes, statsByQuote]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    const aDate = filter === "confermati" ? a.confirmation?.confirmedAt ?? a.createdAt : a.createdAt;
    const bDate = filter === "confermati" ? b.confirmation?.confirmedAt ?? b.createdAt : b.createdAt;
    if (sort === "date_asc") return aDate.localeCompare(bDate);
    if (sort === "lastname") return a.customerLastName.localeCompare(b.customerLastName, "it");
    if (sort === "price") return b.totalPrice - a.totalPrice;
    if (sort === "arrival") return a.arrivalDate.localeCompare(b.arrivalDate);
    return bDate.localeCompare(aDate); // date_desc default
  }), [filter, filtered, sort]);

  const exactCodeSearch = /^is-\d{4}-\d+$/i.test(query.trim()) ? query.trim().toUpperCase() : null;

  async function handleExcludeToggle(quote: Quote) {
    const next = !quote.excludedFromStats;
    if (next) {
      const ok = window.confirm(
        `Vuoi escludere il preventivo ${quote.code} dalle statistiche?\n\nNon verrà conteggiato in dashboard, statistiche e liste operative principali. Potrai reincluderlo dal filtro "Esclusi dalle statistiche".`
      );
      if (!ok) return;
    }

    const response = await adminApiFetch(`/api/quotes/${quote.id}`, {
      method: "PATCH",
      headers: adminApiHeaders(),
      body: JSON.stringify({ excludedFromStats: next })
    });
    const result = await readAdminApiJson<{ ok?: boolean; data?: Quote; error?: string }>(response);
    if (response.ok && result?.data) {
      setQuotes((current) => current.map((q) => (q.id === quote.id ? result.data! : q)));
      setMessage(next ? `${quote.code} escluso dalle statistiche.` : `${quote.code} reinclueso nelle statistiche.`);
      router.refresh();
    } else {
      setMessage(adminApiErrorMessage(response, result));
    }
  }

  async function handleDelete(quote: Quote) {
    const ok = window.confirm(
      `Vuoi cancellare il preventivo ${quote.code}?\n\nVerrà nascosto dalle liste operative e dalle statistiche. Potrai ripristinarlo dal filtro "Cancellati".`
    );
    if (!ok) return;

    const response = await adminApiFetch(`/api/quotes/${quote.id}`, {
      method: "PATCH",
      headers: adminApiHeaders(),
      body: JSON.stringify({ softDelete: true })
    });
    const result = await readAdminApiJson<{ ok?: boolean; data?: Quote; error?: string }>(response);
    if (response.ok && result?.data) {
      setQuotes((current) => current.map((q) => (q.id === quote.id ? result.data! : q)));
      setMessage(`Preventivo ${quote.code} cancellato.`);
      router.refresh();
    } else {
      setMessage(adminApiErrorMessage(response, result, "Cancellazione non riuscita."));
    }
  }

  async function handleRestore(quote: Quote) {
    const response = await adminApiFetch(`/api/quotes/${quote.id}`, {
      method: "POST",
      headers: adminApiHeaders(),
      body: JSON.stringify({ action: "restore" })
    });
    const result = await readAdminApiJson<{ ok?: boolean; data?: Quote; error?: string }>(response);
    if (response.ok && result?.data) {
      setQuotes((current) => current.map((q) => (q.id === quote.id ? result.data! : q)));
      setMessage(`Preventivo ${quote.code} ripristinato.`);
      router.refresh();
    } else {
      setMessage(adminApiErrorMessage(response, result, "Ripristino non riuscito."));
    }
  }

  const actions: QuoteCardActions = {
    onExcludeToggle: handleExcludeToggle,
    onDelete: handleDelete,
    onRestore: handleRestore
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-stretch gap-3 rounded-2xl bg-white/90 px-4 py-3 text-sm shadow-soft sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <span className="font-semibold text-ischia-ink/70">Ultimo aggiornamento: {lastUpdated}</span>
        <button
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-ischia-navy px-4 py-2 font-black text-white disabled:opacity-60"
          disabled={refreshing}
          onClick={handleRefresh}
          type="button"
        >
          {refreshing ? "Aggiornamento..." : "Aggiorna"}
        </button>
      </div>
      <div className="rounded-2xl bg-white/90 p-4 shadow-soft">
        {message ? (
          <p className="mb-3 rounded-xl bg-ischia-mist px-4 py-2 text-sm font-semibold text-ischia-navy">{message}</p>
        ) : null}
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-[1fr_auto_auto]">
          <input
            className="w-full rounded-xl border border-ischia-blue/20 px-4 py-3 text-base sm:text-sm"
            placeholder="Cerca per cliente, email, telefono, codice o hotel..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <select
            className="w-full rounded-xl border border-ischia-blue/20 px-4 py-3 text-base font-semibold text-ischia-navy sm:text-sm"
            value={filter}
            onChange={(event) => setFilter(event.target.value as QuoteFilter)}
          >
            <option value="evasi">Evasi</option>
            <option value="scaduti">Scaduti</option>
            <option value="tutti">Tutti (non cancellati)</option>
            <option value="preventivo_inviato">Inviati</option>
            <option value="alternative">Alternative</option>
            <option value="confermati">Confermati</option>
            <option value="aperti">Preventivo visualizzato</option>
            <option value="non_aperti">Preventivo non visualizzato</option>
            <option value="click_whatsapp">Click WhatsApp</option>
            <option value="perso_non_disponibile">Persi</option>
            <option value="esclusi">Esclusi dalle statistiche</option>
            <option value="cancellati">Cancellati</option>
          </select>
          <select
            className="w-full rounded-xl border border-ischia-blue/20 px-4 py-3 text-base font-semibold text-ischia-navy sm:text-sm"
            value={sort}
            onChange={(event) => setSort(event.target.value as typeof sort)}
          >
            <option value="date_desc">Più recenti</option>
            <option value="date_asc">Più vecchi</option>
            <option value="lastname">Cognome A→Z</option>
            <option value="arrival">Data arrivo</option>
            <option value="price">Prezzo ↓</option>
          </select>
        </div>
      </div>

      {sorted.length
        ? sorted.map((quote) => (
            <QuoteCard key={quote.id} quote={quote} stats={statsByQuote[quote.id]} actions={actions} />
          ))
        : (
            <div className="rounded-2xl bg-white/90 p-6 text-sm font-semibold text-ischia-ink/65 shadow-soft">
              {exactCodeSearch ? `Nessun preventivo trovato con codice ${exactCodeSearch}.` : "Nessun preventivo corrisponde ai filtri selezionati."}
            </div>
          )}
    </div>
  );
}

function formatTime(value: Date) {
  return value.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}
