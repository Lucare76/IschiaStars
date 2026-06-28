import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";
import { PollEmailNowButton } from "@/components/PollEmailNowButton";
import { QuoteFilters } from "@/components/QuoteFilters";
import { getQuoteEventStats } from "@/lib/repositories/quoteEvents";
import { listQuotes } from "@/lib/repositories/quotes";

export const dynamic = "force-dynamic";

const quoteFilters = [
  "evasi",
  "attivi",
  "scaduti",
  "tutti",
  "cancellati",
  "esclusi",
  "preventivo_inviato",
  "alternative",
  "confermati",
  "aperti",
  "non_aperti",
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

  if (quoteResult.source !== "supabase") {
    return (
      <AdminShell title="Preventivi evasi" subtitle="Preventivi giÃ  elaborati, non cancellati e non ancora confermati dal cliente.">
        <DataUnavailable error={quoteResult.error} />
      </AdminShell>
    );
  }

  return (
    <AdminShell title="Preventivi evasi" subtitle="Preventivi già elaborati, non cancellati e non ancora confermati dal cliente.">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-ischia-ink/70">Crea preventivi manuali, cerca per codice o cliente e invia il link cliente su WhatsApp.</p>
        <div className="flex flex-wrap items-start gap-2">
          <PollEmailNowButton />
          <Link className="rounded-full bg-ischia-sun px-5 py-3 text-sm font-black text-ischia-navy shadow-sm" href="/admin/preventivi/nuovo">
            Nuovo preventivo
          </Link>
        </div>
      </div>

      <section>
        <QuoteFilters quotes={quotes} statsByQuote={statsByQuote} initialFilter={initialFilter} />
      </section>
    </AdminShell>
  );
}

function DataUnavailable({ error }: { error?: string }) {
  return (
    <div className="rounded-2xl bg-red-50 p-5 text-sm font-semibold text-red-800 shadow-soft ring-1 ring-red-200">
      <p className="text-base font-black">Preventivi non disponibili</p>
      <p className="mt-2">Impossibile caricare i dati in questo momento. Riprova tra qualche minuto.</p>
      {error ? <p className="mt-3 break-words text-xs text-red-700/80">Dettaglio tecnico: {error}</p> : null}
    </div>
  );
}
