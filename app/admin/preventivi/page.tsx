import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";
import { QuoteFilters } from "@/components/QuoteFilters";
import { getQuoteEventStats } from "@/lib/repositories/quoteEvents";
import { listQuotes } from "@/lib/repositories/quotes";

export const dynamic = "force-dynamic";

export default async function QuotesPage() {
  const quoteResult = await listQuotes({ includeDeleted: true });
  const quotes = quoteResult.data;
  const statsByQuote: Record<string, Awaited<ReturnType<typeof getQuoteEventStats>>["data"]> = {};

  await Promise.all(
    quotes.map(async (quote) => {
      const result = await getQuoteEventStats(quote.id);
      statsByQuote[quote.id] = result.data;
    })
  );

  return (
    <AdminShell title="Tutti i preventivi" subtitle="Il link cliente puo essere aperto o inviato manualmente su WhatsApp senza integrazioni esterne.">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-ischia-ink/70">Crea preventivi manuali, filtra per stato e invia il link cliente su WhatsApp.</p>
        <Link className="rounded-full bg-ischia-sun px-5 py-3 text-sm font-black text-ischia-navy shadow-sm" href="/admin/preventivi/nuovo">
          Nuovo preventivo
        </Link>
      </div>

      <section>
        <QuoteFilters quotes={quotes} statsByQuote={statsByQuote} />
      </section>
    </AdminShell>
  );
}
