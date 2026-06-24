import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/AdminShell";
import { QuoteDetailEditor } from "@/components/QuoteDetailEditor";
import { getEmailLogsForQuote } from "@/lib/repositories/emailLogs";
import { listHotels } from "@/lib/repositories/hotels";
import { getQuoteEvents } from "@/lib/repositories/quoteEvents";
import { getQuoteByCode } from "@/lib/repositories/quotes";
import { getFeatureFlags, getPaymentSettings } from "@/lib/repositories/settings";

export const dynamic = "force-dynamic";

export default async function QuoteDetailPage({ params, searchParams }: { params: { code: string }; searchParams?: { email_error?: string } }) {
  const [quoteResult, hotelResult, paymentSettings, featureFlagsResult] = await Promise.all([
    getQuoteByCode(params.code),
    listHotels(),
    getPaymentSettings(),
    getFeatureFlags()
  ]);
  const quote = quoteResult.data;
  if (!quote) notFound();

  const [quoteEventsResult, emailLogs] = await Promise.all([
    getQuoteEvents(quote.id),
    getEmailLogsForQuote(quote.id),
  ]);

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
      {searchParams?.email_error === "1" ? (
        <div className="mb-5 rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-800 ring-1 ring-rose-200">
          Preventivo creato, ma l&apos;email non è stata inviata. Puoi riprovare dal dettaglio preventivo con il pulsante &quot;Invia preventivo&quot;.
        </div>
      ) : null}
      <QuoteDetailEditor quote={quote} hotels={hotelResult.data} paymentSettings={paymentSettings.data} featureFlags={featureFlagsResult.data} quoteEvents={quoteEventsResult.data} emailLogs={emailLogs} />
    </AdminShell>
  );
}
