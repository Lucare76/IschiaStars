import { AdminShell } from "@/components/AdminShell";
import { NewQuoteForm } from "@/components/NewQuoteForm";
import { listHotels } from "@/lib/repositories/hotels";
import { getQuoteRequestById } from "@/lib/repositories/quoteRequests";

export const dynamic = "force-dynamic";

export default async function NewQuotePage({ searchParams }: { searchParams: { requestId?: string; lab?: string; manualConfirmation?: string } }) {
  const [hotelResult, requestResult] = await Promise.all([
    listHotels(),
    searchParams.requestId ? getQuoteRequestById(searchParams.requestId) : Promise.resolve({ data: null, source: "mock" as const })
  ]);

  const isLabTest = searchParams.lab === "true";
  const manualConfirmation = searchParams.manualConfirmation === "true";

  return (
    <AdminShell
      title={manualConfirmation ? "Importa conferma via email" : "Nuovo preventivo"}
      subtitle={manualConfirmation ? "Registra una vecchia prenotazione confermata e prepara il voucher cliente." : "Crea manualmente una proposta IschiaStars, anche con struttura alternativa se l'hotel richiesto non è disponibile."}
    >
      <NewQuoteForm hotels={hotelResult.data} initialRequest={requestResult.data} requestedRequestId={searchParams.requestId} isLabTest={isLabTest} manualConfirmation={manualConfirmation} />
    </AdminShell>
  );
}
