import { notFound } from "next/navigation";
import { AdminShell } from "@/components/AdminShell";
import { QuoteDetailEditor } from "@/components/QuoteDetailEditor";
import { listHotels } from "@/lib/repositories/hotels";
import { listQuotes } from "@/lib/repositories/quotes";

export const dynamic = "force-dynamic";

export default async function QuoteDetailPage({ params }: { params: { code: string } }) {
  const [quoteResult, hotelResult] = await Promise.all([listQuotes(), listHotels()]);
  const quote = quoteResult.data.find((item) => item.code === params.code);
  if (!quote) notFound();

  return (
    <AdminShell title={`Preventivo ${quote.code}`} subtitle="Modifica proposta, trasporti, condizioni e stato operativo.">
      <QuoteDetailEditor quote={quote} hotels={hotelResult.data} />
    </AdminShell>
  );
}
