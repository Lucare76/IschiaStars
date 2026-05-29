import Link from "next/link";
import { QuoteStatusBadge } from "@/components/QuoteStatusBadge";
import { WhatsAppSendButton } from "@/components/WhatsAppSendButton";
import { formatCurrency, formatDate, formatDateTime, publicQuoteUrl } from "@/lib/utils";
import { Quote, QuoteRequest } from "@/lib/types";

export type QuoteStats = {
  openings: number;
  lastOpening?: string;
  whatsappClicks: number;
  confirmClicked: boolean;
  confirmed: boolean;
};

export function RequestCard({ request }: { request: QuoteRequest }) {
  return (
    <article className="rounded-2xl border border-white bg-white/86 p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-ischia-navy">{request.firstName} {request.lastName}</h2>
          <p className="text-sm text-ischia-ink/65">{request.email} - {request.phone}</p>
        </div>
        <QuoteStatusBadge status={request.status} />
      </div>
      <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-6">
        <Info label="Zona" value={request.destination} />
        <Info label="Hotel richiesto" value={request.requestedHotel ?? "Da definire"} />
        <Info label="Date" value={`${formatDate(request.arrivalDate)} - ${formatDate(request.departureDate)}`} />
        <Info label="Ospiti" value={`${request.adults} adulti, ${request.children.length} bambini`} />
        <Info label="Camere" value={`${request.rooms}`} />
        <Info label="Trattamento" value={request.requestedTreatment ?? "Da definire"} />
      </dl>
      {request.children.length ? <p className="mt-3 text-sm text-ischia-ink/70">Bambini: {request.children.map((child) => `${child.firstName} (${formatDate(child.birthDate)})`).join(", ")}</p> : null}
      {request.message ? <p className="mt-4 rounded-xl bg-ischia-mist p-4 text-sm text-ischia-ink/80">{request.message}</p> : null}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-ischia-blue/10 pt-4 text-sm">
        <span>Ricevuta: {formatDateTime(request.receivedAt)}</span>
        <Link className="rounded-full bg-ischia-sun px-4 py-2 font-bold text-ischia-navy" href={`/admin/preventivi/nuovo?requestId=${request.id}`}>
          Crea preventivo
        </Link>
      </div>
    </article>
  );
}

export function QuoteCard({ quote, stats: providedStats }: { quote: Quote; stats?: QuoteStats }) {
  const stats = providedStats ?? { openings: 0, whatsappClicks: 0, confirmClicked: false, confirmed: false };
  const effectiveStatus = stats.confirmed ? "confermato" : quote.status === "perso_non_disponibile" ? "perso_non_disponibile" : stats.openings > 0 ? "aperto" : quote.status;
  return (
    <article className="rounded-2xl border border-white bg-white/90 p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-ischia-blue">{quote.code}</p>
          <h2 className="text-xl font-black text-ischia-navy">{quote.customerFirstName} {quote.customerLastName}</h2>
        </div>
        <QuoteStatusBadge status={effectiveStatus} />
      </div>
      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <Info label="Hotel" value={quote.proposedHotel.name} />
        <Info label="Date" value={`${formatDate(quote.arrivalDate)} - ${formatDate(quote.departureDate)}`} />
        <Info label="Totale" value={formatCurrency(quote.totalPrice)} />
        <Info label="Aperture" value={`${stats.openings}`} />
      </div>
      {quote.isAlternative ? <p className="mt-4 inline-flex rounded-full bg-ischia-sun/25 px-3 py-1 text-xs font-black text-amber-900">Alternativa proposta</p> : null}
      <div className="mt-5 flex flex-wrap gap-2">
        <Link className="rounded-full bg-ischia-navy px-4 py-2 text-sm font-bold text-white" href={publicQuoteUrl(quote)}>
          Apri link cliente
        </Link>
        <WhatsAppSendButton quote={quote} />
        <Link className="rounded-full bg-white px-4 py-2 text-sm font-bold text-ischia-navy ring-1 ring-ischia-blue/20" href={`/admin/preventivi/${quote.code}`}>
          Dettaglio / modifica
        </Link>
      </div>
      <p className="mt-4 text-xs text-ischia-ink/58">Ultima apertura: {stats.lastOpening ? formatDateTime(stats.lastOpening) : "non ancora aperto"} - Click WhatsApp: {stats.whatsappClicks}</p>
    </article>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-[0.12em] text-ischia-blue/75">{label}</dt>
      <dd className="mt-1 font-semibold text-ischia-ink">{value}</dd>
    </div>
  );
}
