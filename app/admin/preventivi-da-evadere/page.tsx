import { AdminShell } from "@/components/AdminShell";
import { PendingRequestCard } from "@/components/PendingRequestCard";
import { PendingRequestsRefresh } from "@/components/PendingRequestsRefresh";
import { listPendingQuoteRequests } from "@/lib/repositories/quoteRequests";

export const dynamic = "force-dynamic";

export default async function PendingRequestsPage() {
  const requestResult = await listPendingQuoteRequests();
  const quoteRequests = requestResult.data;

  return (
    <AdminShell title="Preventivi da evadere" subtitle="Qui trovi le richieste arrivate dal sito: da ogni scheda puoi creare un preventivo già precompilato.">
      <PendingRequestsRefresh />
      {requestResult.source === "supabase" ? (
        <div className="grid gap-5">
          {quoteRequests.length ? quoteRequests.map((request) => <PendingRequestCard key={request.id} request={request} />) : <div className="rounded-2xl bg-white/90 p-6 text-sm font-semibold text-ischia-ink/65 shadow-soft">Nessun preventivo da evadere</div>}
        </div>
      ) : (
        <DataUnavailable error={requestResult.error} />
      )}
    </AdminShell>
  );
}

function DataUnavailable({ error }: { error?: string }) {
  return (
    <div className="rounded-2xl bg-red-50 p-5 text-sm font-semibold text-red-800 shadow-soft ring-1 ring-red-200">
      <p className="text-base font-black">Richieste non disponibili</p>
      <p className="mt-2">Impossibile caricare i dati in questo momento. Riprova tra qualche minuto.</p>
      {error ? <p className="mt-3 break-words text-xs text-red-700/80">Dettaglio tecnico: {error}</p> : null}
    </div>
  );
}
