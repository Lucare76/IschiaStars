import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";
import { StatsCards } from "@/components/StatsCards";
import { QuoteCard, RequestCard } from "@/components/QuoteCard";
import { listPendingQuoteRequests } from "@/lib/repositories/quoteRequests";
import { getQuoteEventStats } from "@/lib/repositories/quoteEvents";
import { listQuotes } from "@/lib/repositories/quotes";
import { getDashboardStats } from "@/lib/repositories/stats";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [requestResult, quoteResult, statsResult] = await Promise.all([listPendingQuoteRequests(), listQuotes(), getDashboardStats()]);
  const quoteRequests = requestResult.data;
  const quotes = quoteResult.data;
  const featuredQuote = quotes[0];
  const featuredQuoteStats = featuredQuote ? (await getQuoteEventStats(featuredQuote.id)).data : null;

  return (
    <AdminShell title="Dashboard preventivi" subtitle="Panoramica delle richieste, dei preventivi inviati e delle conferme cliente.">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.34fr)]">
        <section className="min-w-0 space-y-6">
          <StatsCards stats={statsResult.data} />
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-2xl font-black text-ischia-navy">Ultime richieste da evadere</h2>
              <Link className="text-sm font-bold text-ischia-blue" href="/admin/preventivi-da-evadere">Vedi tutte</Link>
            </div>
            <div className="grid gap-4">
              {quoteRequests.length ? quoteRequests.slice(0, 2).map((request) => <RequestCard key={request.id} request={request} />) : <EmptyState text="Nessun preventivo da evadere" />}
            </div>
          </div>
        </section>

        <aside className="min-w-0 space-y-4">
          <div className="rounded-2xl bg-ischia-sun p-5 text-ischia-navy shadow-soft">
            <h2 className="text-xl font-black">Contatto diretto</h2>
            <p className="mt-2 text-sm font-semibold">Telefono 081 90 54 81</p>
            <p className="text-sm font-semibold">WhatsApp 371 75 90 017</p>
          </div>
          {featuredQuote && featuredQuoteStats ? <QuoteCard quote={featuredQuote} stats={featuredQuoteStats} /> : null}
        </aside>
      </div>
    </AdminShell>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl bg-white/90 p-6 text-sm font-semibold text-ischia-ink/65 shadow-soft">{text}</div>;
}
