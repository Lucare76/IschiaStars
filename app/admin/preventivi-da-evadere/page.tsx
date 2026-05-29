import { AdminShell } from "@/components/AdminShell";
import { RequestCard } from "@/components/QuoteCard";
import { listPendingQuoteRequests } from "@/lib/repositories/quoteRequests";

export const dynamic = "force-dynamic";

export default async function PendingRequestsPage() {
  const requestResult = await listPendingQuoteRequests();
  const quoteRequests = requestResult.data;

  return (
    <AdminShell title="Preventivi da evadere" subtitle="Qui trovi le richieste arrivate dal sito: da ogni scheda puoi creare un preventivo gia precompilato.">
      <div className="grid gap-5">
        {quoteRequests.length ? quoteRequests.map((request) => <RequestCard key={request.id} request={request} />) : <div className="rounded-2xl bg-white/90 p-6 text-sm font-semibold text-ischia-ink/65 shadow-soft">Nessun preventivo da evadere</div>}
      </div>
    </AdminShell>
  );
}
