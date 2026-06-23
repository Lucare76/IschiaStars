import { AdminShell } from "@/components/AdminShell";
import { NewQuoteForm } from "@/components/NewQuoteForm";
import { listHotels } from "@/lib/repositories/hotels";
import { getQuoteRequestById } from "@/lib/repositories/quoteRequests";

export const dynamic = "force-dynamic";

export default async function NewQuotePage({ searchParams }: { searchParams: { requestId?: string; lab?: string; manualConfirmation?: string } }) {
  const [hotelResult, requestResult] = await Promise.all([
    listHotels(),
    searchParams.requestId ? getQuoteRequestById(searchParams.requestId) : Promise.resolve({ data: null, source: "mock" as const, error: undefined })
  ]);

  const isLabTest = searchParams.lab === "true";
  const manualConfirmation = searchParams.manualConfirmation === "true";
  const requestUnavailable = Boolean(searchParams.requestId) && requestResult.source !== "supabase";

  return (
    <AdminShell
      title={manualConfirmation ? "Importa conferma via email" : "Nuovo preventivo"}
      subtitle={manualConfirmation ? "Registra una vecchia prenotazione confermata e prepara il voucher cliente." : "Crea manualmente una proposta IschiaStars, anche con struttura alternativa se l'hotel richiesto non è disponibile."}
    >
      {hotelResult.source === "supabase" && !requestUnavailable ? (
        <NewQuoteForm hotels={hotelResult.data} initialRequest={requestResult.data} requestedRequestId={searchParams.requestId} isLabTest={isLabTest} manualConfirmation={manualConfirmation} />
      ) : (
        <DataUnavailable error={[hotelResult.error, requestUnavailable ? requestResult.error : undefined].filter(Boolean).join(" | ")} />
      )}
    </AdminShell>
  );
}

function DataUnavailable({ error }: { error?: string }) {
  return (
    <div className="rounded-2xl bg-red-50 p-5 text-sm font-semibold text-red-800 shadow-soft ring-1 ring-red-200">
      <p className="text-base font-black">Dati non disponibili</p>
      <p className="mt-2">Impossibile caricare i dati in questo momento. Riprova tra qualche minuto.</p>
      {error ? <p className="mt-3 break-words text-xs text-red-700/80">Dettaglio tecnico: {error}</p> : null}
    </div>
  );
}
