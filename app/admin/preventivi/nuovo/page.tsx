import { AdminShell } from "@/components/AdminShell";
import { NewQuoteForm } from "@/components/NewQuoteForm";
import { listHotels } from "@/lib/repositories/hotels";
import { getQuoteRequestById } from "@/lib/repositories/quoteRequests";

export const dynamic = "force-dynamic";

export default async function NewQuotePage({ searchParams }: { searchParams: { requestId?: string } }) {
  const [hotelResult, requestResult] = await Promise.all([
    listHotels(),
    searchParams.requestId ? getQuoteRequestById(searchParams.requestId) : Promise.resolve({ data: null, source: "mock" as const })
  ]);

  return (
    <AdminShell title="Nuovo preventivo" subtitle="Crea manualmente una proposta IschiaStars, anche con struttura alternativa se l'hotel richiesto non è disponibile.">
      <NewQuoteForm hotels={hotelResult.data} initialRequest={requestResult.data} requestedRequestId={searchParams.requestId} />
    </AdminShell>
  );
}
