import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";
import { StatsCards } from "@/components/StatsCards";
import { QuoteCard, RequestCard } from "@/components/QuoteCard";
import { getDashboardEventStats } from "@/lib/repositories/quoteEvents";
import { listPendingQuoteRequests } from "@/lib/repositories/quoteRequests";
import { listQuotes } from "@/lib/repositories/quotes";
import { buildDashboardStats } from "@/lib/repositories/stats";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [requestResult, quoteResult, eventsResult] = await Promise.all([listPendingQuoteRequests(), listQuotes(), getDashboardEventStats()]);

  if (requestResult.source !== "supabase" || quoteResult.source !== "supabase" || eventsResult.source !== "supabase") {
    const error = [requestResult.error, quoteResult.error, eventsResult.error].filter(Boolean).join(" | ");
    return (
      <AdminShell title="Dashboard preventivi" subtitle="Panoramica delle richieste, dei preventivi inviati e delle conferme cliente.">
        <DataUnavailable error={error} />
      </AdminShell>
    );
  }

  const quoteRequests = requestResult.data;
  const activeQuotes = quoteResult.data.filter((quote) => !quote.deletedAt && !quote.excludedFromStats);
  const dashboardStats = buildDashboardStats({
    quotes: quoteResult.data,
    pendingRequests: quoteRequests,
    openedQuoteIds: eventsResult.data.openedQuoteIds,
    confirmedEventIds: eventsResult.data.confirmedEventIds,
    whatsappClickQuoteIds: eventsResult.data.whatsappClickQuoteIds
  });
  const featuredQuote = activeQuotes[0];

  return (
    <AdminShell title="Dashboard preventivi" subtitle="Panoramica delle richieste, dei preventivi inviati e delle conferme cliente.">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <section className="min-w-0 space-y-7">
          <StatsCards stats={dashboardStats} />

          <div>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-black text-ischia-navy">
                Ultime richieste da evadere
                {quoteRequests.length > 0 && (
                  <span className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-xs font-black text-white">
                    {quoteRequests.length}
                  </span>
                )}
              </h2>
              <Link className="text-sm font-bold text-ischia-blue hover:underline" href="/admin/preventivi-da-evadere">
                Vedi tutte →
              </Link>
            </div>
            <div className="grid gap-4">
              {quoteRequests.length
                ? quoteRequests.slice(0, 2).map((request) => <RequestCard key={request.id} request={request} />)
                : <EmptyState text="Nessuna richiesta in attesa" />}
            </div>
          </div>
        </section>

        <aside className="min-w-0 space-y-4">
          <div className="rounded-2xl bg-ischia-navy p-5 text-white shadow-soft">
            <p className="text-xs font-bold uppercase tracking-widest text-white/60">Contatto diretto</p>
            <a href="tel:0819054811" className="mt-3 flex items-center gap-2 text-sm font-semibold hover:text-ischia-sand">
              <span className="text-ischia-sand">☎</span> 081 90 54 81
            </a>
            <a href="https://wa.me/393717590017" className="mt-1 flex items-center gap-2 text-sm font-semibold hover:text-ischia-leaf" target="_blank" rel="noreferrer">
              <span className="text-ischia-leaf">●</span> WhatsApp 371 75 90 017
            </a>
          </div>

          {featuredQuote ? (
            <QuoteCard quote={featuredQuote} />
          ) : null}
        </aside>
      </div>
    </AdminShell>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl bg-white/90 p-6 text-center text-sm font-semibold text-ischia-ink/50 shadow-soft">
      {text}
    </div>
  );
}

function DataUnavailable({ error }: { error?: string }) {
  return (
    <div className="rounded-2xl bg-red-50 p-5 text-sm font-semibold text-red-800 shadow-soft ring-1 ring-red-200">
      <p className="text-base font-black">Dati dashboard non disponibili</p>
      <p className="mt-2">
        Connessione al database non riuscita. Per evitare numeri demo o dati non reali, la dashboard resta nascosta finche Supabase non risponde correttamente.
      </p>
      {error ? <p className="mt-3 break-words text-xs text-red-700/80">Dettaglio tecnico: {error}</p> : null}
    </div>
  );
}
