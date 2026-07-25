import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";
import { PollEmailNowButton } from "@/components/PollEmailNowButton";
import { QuoteStats } from "@/components/QuoteCard";
import { QuotesPageContent } from "@/components/QuotesPageContent";
import { getQuoteEventStatsForQuoteIds } from "@/lib/repositories/quoteEvents";
import { listQuotesPage } from "@/lib/repositories/quotes";

export const dynamic = "force-dynamic";

const FILTERS = [
  { value: "evasi", label: "Attivi" },
  { value: "scaduti", label: "Scaduti" },
  { value: "confermati", label: "Confermati" },
  { value: "cancellati", label: "Cancellati" },
  { value: "esclusi", label: "Esclusi" },
  { value: "alternative", label: "Alternative" },
  { value: "perso_non_disponibile", label: "Persi" },
  { value: "tutti", label: "Tutti" },
] as const;

const SORTS = [
  { value: "date_desc", label: "Più recenti" },
  { value: "date_asc", label: "Meno recenti" },
  { value: "lastname", label: "Cognome" },
  { value: "arrival", label: "Arrivo" },
  { value: "price", label: "Prezzo" },
] as const;

type PageSearchParams = {
  filter?: string;
  q?: string;
  sort?: string;
  page?: string;
};

function makeHref(
  base: { filter: string; sort: string; search: string; page: number },
  overrides: Partial<{ filter: string; sort: string; q: string; page: number }>
) {
  const f = overrides.filter ?? base.filter;
  const s = overrides.sort ?? base.sort;
  const q = overrides.q !== undefined ? overrides.q : base.search;
  const p = overrides.page ?? 1;
  const params = new URLSearchParams();
  if (f !== "evasi") params.set("filter", f);
  if (s !== "date_desc") params.set("sort", s);
  if (q) params.set("q", q);
  if (p > 1) params.set("page", String(p));
  const qs = params.toString();
  return `/admin/preventivi${qs ? `?${qs}` : ""}`;
}

export default async function QuotesListPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const filter = FILTERS.some((f) => f.value === searchParams?.filter) ? searchParams!.filter! : "evasi";
  const sort = SORTS.some((s) => s.value === searchParams?.sort) ? searchParams!.sort! : "date_desc";
  const search = (searchParams?.q ?? "").trim();
  const page = Math.max(1, parseInt(searchParams?.page ?? "1", 10) || 1);

  const base = { filter, sort, search, page };

  const pageResult = await listQuotesPage({ page, filter, search, sort });
  const quotes = pageResult.data.items;
  const hasNextPage = pageResult.data.hasNextPage;

  const quoteIds = quotes.map((q) => q.id);
  const statsResult = quoteIds.length > 0 ? await getQuoteEventStatsForQuoteIds(quoteIds) : { data: {} };
  const statsByQuote = statsResult.data as Record<string, QuoteStats>;

  return (
    <AdminShell title="Preventivi">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-black text-ischia-navy sm:text-2xl">Preventivi</h1>
          <p className="mt-0.5 text-sm text-ischia-ink/55">
            {search ? `Ricerca: "${search}" · ` : ""}
            Pagina {page}
            {!hasNextPage && quotes.length > 0 ? " (ultima)" : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PollEmailNowButton />
          <Link
            className="rounded-full bg-ischia-sun px-4 py-2 text-sm font-bold text-ischia-navy"
            href="/admin/preventivi/nuovo"
          >
            + Nuovo preventivo
          </Link>
        </div>
      </div>

      {/* Search */}
      <form action="/admin/preventivi" className="mb-4" method="get">
        {filter !== "evasi" && <input name="filter" type="hidden" value={filter} />}
        {sort !== "date_desc" && <input name="sort" type="hidden" value={sort} />}
        <div className="flex gap-2">
          <input
            className="min-w-0 flex-1 rounded-full border border-ischia-blue/20 bg-white px-4 py-2 text-sm text-ischia-ink placeholder:text-ischia-ink/40 focus:outline-none focus:ring-2 focus:ring-ischia-blue/30"
            defaultValue={search}
            name="q"
            placeholder="Cerca per cognome, email, telefono, codice, hotel…"
            type="search"
          />
          <button
            className="shrink-0 rounded-full bg-ischia-navy px-4 py-2 text-sm font-bold text-white"
            type="submit"
          >
            Cerca
          </button>
          {search ? (
            <Link
              className="shrink-0 rounded-full bg-white px-4 py-2 text-sm font-bold text-ischia-ink ring-1 ring-ischia-blue/20"
              href={makeHref(base, { q: "", page: 1 })}
            >
              ✕
            </Link>
          ) : null}
        </div>
      </form>

      {/* Filter tabs */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <Link
            className={`rounded-full px-3 py-1.5 text-sm font-bold transition ${
              f.value === filter
                ? "bg-ischia-navy text-white"
                : "bg-white text-ischia-ink ring-1 ring-ischia-blue/20 hover:bg-ischia-mist"
            }`}
            href={makeHref(base, { filter: f.value, page: 1 })}
            key={f.value}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {/* Sort */}
      <div className="mb-5 flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-bold uppercase tracking-wide text-ischia-ink/50">Ordina:</span>
        {SORTS.map((s) => (
          <Link
            className={`rounded-full px-3 py-1 text-xs font-bold transition ${
              s.value === sort
                ? "bg-ischia-blue/15 text-ischia-navy"
                : "text-ischia-ink/60 hover:text-ischia-navy"
            }`}
            href={makeHref(base, { sort: s.value, page: 1 })}
            key={s.value}
          >
            {s.label}
          </Link>
        ))}
      </div>

      {/* Quote list */}
      <QuotesPageContent quotes={quotes} statsByQuote={statsByQuote} />

      {/* Pagination */}
      {(page > 1 || hasNextPage) ? (
        <div className="mt-6 flex items-center justify-between gap-3">
          {page > 1 ? (
            <Link
              className="rounded-full bg-white px-5 py-2 text-sm font-bold text-ischia-navy ring-1 ring-ischia-blue/20"
              href={makeHref(base, { page: page - 1 })}
            >
              ← Precedente
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm text-ischia-ink/55">Pagina {page}</span>
          {hasNextPage ? (
            <Link
              className="rounded-full bg-white px-5 py-2 text-sm font-bold text-ischia-navy ring-1 ring-ischia-blue/20"
              href={makeHref(base, { page: page + 1 })}
            >
              Successiva →
            </Link>
          ) : (
            <span />
          )}
        </div>
      ) : null}
    </AdminShell>
  );
}
