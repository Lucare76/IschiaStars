import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/AdminShell";
import { QuoteDetailEditor } from "@/components/QuoteDetailEditor";
import { listHotels } from "@/lib/repositories/hotels";
import { getQuoteByCode } from "@/lib/repositories/quotes";
import { getPaymentSettings } from "@/lib/repositories/settings";

export const dynamic = "force-dynamic";

export default async function QuoteDetailPage({ params }: { params: { code: string } }) {
  const [quoteResult, hotelResult, paymentSettings] = await Promise.all([getQuoteByCode(params.code), listHotels(), getPaymentSettings()]);
  const quote = quoteResult.data;
  if (!quote) notFound();

  return (
    <AdminShell title={`Preventivo ${quote.code}`} subtitle="Modifica proposta, trasporti, condizioni e stato operativo.">
      <div className="mb-5 flex flex-wrap gap-2">
        <Link className="rounded-full bg-white px-4 py-2 text-sm font-black text-ischia-navy shadow-sm ring-1 ring-ischia-blue/15" href="/admin">
          ← Dashboard
        </Link>
        <Link className="rounded-full bg-white px-4 py-2 text-sm font-black text-ischia-navy shadow-sm ring-1 ring-ischia-blue/15" href="/admin/preventivi">
          Tutti i preventivi
        </Link>
      </div>
      <QuoteDetailEditor quote={quote} hotels={hotelResult.data} paymentSettings={paymentSettings.data} />
    </AdminShell>
  );
}
