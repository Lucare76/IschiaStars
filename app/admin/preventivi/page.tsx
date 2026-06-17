import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";
import { QuoteFilters } from "@/components/QuoteFilters";
import { getQuoteEventStats } from "@/lib/repositories/quoteEvents";
import { listQuotes } from "@/lib/repositories/quotes";

export const dynamic = "force-dynamic";

const quoteFilters = [
  "evasi",
  "attivi",
  "tutti",
  "cancellati",
  "esclusi",
  "preventivo_inviato",
  "alternative",
  "confermati",
  "aperti",
  "click_whatsapp",
  "perso_non_disponibile"
] as const;

type QuoteFilter = (typeof quoteFilters)[number];

function getInitialFilter(filter: string | string[] | undefined): QuoteFilter {
  const value = Array.isArray(filter) ? filter[0] : filter;
  return quoteFilters.includes(value as QuoteFilter) ? (value as QuoteFilter) : "evasi";
}

export default async function QuotesPage({ searchParams }: { searchParams?: { filter?: string | string[] } }) {
  const quoteResult = await listQuotes({ includeDeleted: true });
  const quotes = quoteResult.data;
  const statsByQuote: Record<string, Awaited<ReturnType<typeof getQuoteEventStats>>["data"]> = {};
  const initialFilter = getInitialFilter(searchParams?.filter);

  await Promise.all(
    quotes.map(async (quote) => {
      const result = await getQuoteEventStats(quote.id);
      statsByQuote[quote.id] = result.data;
    })
  );

  return (
    <AdminShell title="Preventivi evasi" subtitle="Preventivi già elaborati, non cancellati e non ancora confermati dal cliente.">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-ischia-ink/70">Crea preventivi manuali, cerca per codice o cliente e invia il link cliente su WhatsApp.</p>
        <Link className="rounded-full bg-ischia-sun px-5 py-3 text-sm font-black text-ischia-navy shadow-sm" href="/admin/preventivi/nuovo">
          Nuovo preventivo
        </Link>
      </div>

      <section>
        {quoteResult.source !== "supabase" ? (
          <div className="mb-5 rounded-2xl bg-red-50 px-5 py-4 text-sm font-bold text-red-700 ring-1 ring-red-200">
            Database non collegato: stai visualizzando dati demo/locali. Le modifiche non vengono salvate nel database reale.
          </div>
        ) : null}
        <QuoteFilters quotes={quotes} statsByQuote={statsByQuote} initialFilter={initialFilter} />
      </section>
    </AdminShell>
  );
}
