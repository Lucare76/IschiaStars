import Link from "next/link";
import { CloneQuoteButton } from "@/components/CloneQuoteButton";
import { QuoteStatusBadge } from "@/components/QuoteStatusBadge";
import { WhatsAppSendButton } from "@/components/WhatsAppSendButton";
import { getEffectiveHotelOptions } from "@/lib/repositories/shared";
import { formatCurrency, formatDate, formatDateTime, publicQuoteUrl } from "@/lib/utils";
import { Quote, QuoteRequest } from "@/lib/types";

export type QuoteStats = {
  openings: number;
  lastOpening?: string;
  whatsappClicks: number;
  confirmClicked: boolean;
  confirmed: boolean;
};

export type QuoteCardActions = {
  onExcludeToggle?: (quote: Quote) => void;
  onDelete?: (quote: Quote) => void;
  onRestore?: (quote: Quote) => void;
};

export function RequestCard({ request }: { request: QuoteRequest }) {
  const showImportedAt = request.importedAt && request.importedAt !== request.receivedAt;

  return (
    <article className="min-w-0 rounded-2xl border border-white bg-white/86 p-4 shadow-soft sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="break-words text-lg font-black leading-tight text-ischia-navy sm:text-xl">{request.firstName} {request.lastName}</h2>
          <p className="break-words text-sm text-ischia-ink/65">{request.email} - {request.phone}</p>
        </div>
        <QuoteStatusBadge status={request.status} />
      </div>
      <dl className="mt-5 grid gap-x-4 gap-y-4 text-sm sm:grid-cols-2 xl:grid-cols-[0.75fr_1.15fr_1fr_1fr_0.55fr_1fr]">
        <Info label="Zona" value={request.destination} />
        <Info label="Hotel richiesto" value={request.requestedHotel ?? "Da definire"} />
        <Info label="Date" value={`${formatDate(request.arrivalDate)} - ${formatDate(request.departureDate)}`} numeric />
        <Info label="Ospiti" value={`${request.adults} adulti, ${request.children.length} bambini`} numeric />
        <Info label="Camere" value={`${request.rooms}`} numeric />
        <Info label="Trattamento" value={request.requestedTreatment ?? "Da definire"} />
      </dl>
      {request.children.length ? (
        <p className="mt-3 text-sm text-ischia-ink/70">
          Bambini: {request.children.map((child, index) => {
            if (child.age != null) return `Bambino ${index + 1}: ${child.age} ${child.age === 1 ? "anno" : "anni"}`;
            if (child.birthDate) return `${child.firstName} (${formatDate(child.birthDate)})`;
            return `Bambino ${index + 1}`;
          }).join(", ")}
        </p>
      ) : null}
      {request.message ? <p className="mt-4 rounded-xl bg-ischia-mist p-4 text-sm text-ischia-ink/80">{request.message}</p> : null}
      <div className="mt-5 flex flex-col items-stretch gap-3 border-t border-ischia-blue/10 pt-4 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <span>
          Ricevuta: {formatDateTime(request.receivedAt)}
          {showImportedAt ? ` - Importata: ${formatDateTime(request.importedAt!)}` : ""}
        </span>
        <Link className="rounded-full bg-ischia-sun px-4 py-2 text-center font-bold text-ischia-navy" href={`/admin/preventivi/nuovo?requestId=${request.id}`}>
          Crea preventivo
        </Link>
      </div>
    </article>
  );
}

function isExpiresSoon(offerExpiresAt?: string): boolean {
  if (!offerExpiresAt) return false;
  const expiresAt = new Date(offerExpiresAt).getTime();
  if (!Number.isFinite(expiresAt)) return false;
  const diff = expiresAt - Date.now();
  return diff >= 0 && diff <= 3 * 24 * 60 * 60 * 1000;
}

export function QuoteCard({ quote, stats: providedStats, actions }: { quote: Quote; stats?: QuoteStats; actions?: QuoteCardActions }) {
  const stats = providedStats ?? { openings: 0, whatsappClicks: 0, confirmClicked: false, confirmed: false };
  const effectiveStatus = stats.confirmed ? "confermato" : quote.status === "perso_non_disponibile" ? "perso_non_disponibile" : stats.openings > 0 ? "aperto" : quote.status;
  const isDeleted = Boolean(quote.deletedAt);
  const hasConfirmation = Boolean(quote.confirmation);
  const expiresSoon = !isDeleted && !hasConfirmation && isExpiresSoon(quote.offerExpiresAt);
  const guestCount = quote.adults + quote.children.length;
  const guestLabel = `${guestCount} ${guestCount === 1 ? "persona" : "persone"} (${quote.adults} ${quote.adults === 1 ? "adulto" : "adulti"}${quote.children.length ? `, ${quote.children.length} ${quote.children.length === 1 ? "bambino" : "bambini"}` : ""})`;
  const priceLabel = getQuotePriceLabel(quote);

  return (
    <article className={`min-w-0 rounded-2xl border border-white p-4 shadow-soft sm:p-5 ${isDeleted ? "bg-rose-50/60 opacity-75" : "bg-white/90"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-ischia-blue">{quote.code}</p>
          <h2 className="break-words text-lg font-black leading-tight text-ischia-navy sm:text-xl">{quote.customerFirstName} {quote.customerLastName}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {expiresSoon ? (
            <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-black text-orange-700">⏰ Scadenza vicina</span>
          ) : null}
          {quote.excludedFromStats && !isDeleted ? (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">Escluso stats</span>
          ) : null}
          {isDeleted ? (
            <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-black text-rose-700">Cancellato</span>
          ) : (
            <QuoteStatusBadge status={effectiveStatus} />
          )}
        </div>
      </div>
      <div className="mt-4 grid gap-x-4 gap-y-4 text-sm sm:grid-cols-2">
        {(() => {
          const options = getEffectiveHotelOptions(quote);
          const selectedOption = options.find((o) => o.isSelected);
          const confirmedOption = quote.confirmation?.selectedHotelOptionId
            ? options.find((o) => o.id === quote.confirmation?.selectedHotelOptionId)
            : selectedOption;
          const hotelLabel = options.length > 1 ? `${options.length} strutture proposte` : (options[0]?.hotelName ?? quote.proposedHotel.name);
          const confirmedDetails = [
            quote.confirmation?.selectedHotelName ?? confirmedOption?.hotelName,
            confirmedOption?.roomTypeLabel,
            quote.confirmation?.selectedTreatmentLabel,
            quote.confirmation?.selectedPrice != null ? formatCurrency(quote.confirmation.selectedPrice) : undefined
          ].filter(Boolean).join(" - ");
          return (
            <>
              <Info className="col-span-2 sm:col-span-1" label="Hotel" value={hotelLabel} />
              {confirmedDetails && quote.status === "confermato" && (
                <Info className="col-span-2 sm:col-span-1" label="Scelta confermata" value={confirmedDetails} />
              )}
            </>
          );
        })()}
        <Info label="Date" value={`${formatDate(quote.arrivalDate)} - ${formatDate(quote.departureDate)}`} numeric />
        <Info label="Persone" value={guestLabel} numeric />
        <Info label="Prezzo" value={priceLabel} numeric />
        {!isDeleted ? <Info label="Aperture" value={`${stats.openings}`} numeric /> : null}
      </div>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {!isDeleted ? (
          hasConfirmation ? (
            <>
              <Link className="rounded-full bg-ischia-leaf px-4 py-2 text-center text-sm font-bold text-white" href={`/admin/preventivi/${quote.code}#verifica-disponibilita`}>
                Gestisci conferma
              </Link>
              <Link className="rounded-full bg-white px-4 py-2 text-center text-sm font-bold text-ischia-navy ring-1 ring-ischia-blue/20" href={`/admin/conferme?filter=${quote.confirmation?.availabilityStatus ?? "availability_to_check"}`}>
                Vai a conferme
              </Link>
              <Link className="rounded-full bg-white px-4 py-2 text-center text-sm font-bold text-ischia-navy ring-1 ring-ischia-blue/20" href={`/admin/preventivi/${quote.code}`}>
                Dettaglio
              </Link>
            </>
          ) : (
            <>
              <Link className="rounded-full bg-ischia-navy px-4 py-2 text-center text-sm font-bold text-white" href={publicQuoteUrl(quote)} rel="noopener noreferrer" target="_blank">
                Apri link cliente
              </Link>
              <WhatsAppSendButton quote={quote} />
            <Link className="rounded-full bg-white px-4 py-2 text-center text-sm font-bold text-ischia-navy ring-1 ring-ischia-blue/20" href={`/admin/preventivi/${quote.code}`}>
              Dettaglio / modifica
            </Link>
            <CloneQuoteButton quoteId={quote.id} />
            </>
          )
        ) : null}
        {actions?.onRestore && isDeleted ? (
          <button
            className="rounded-full bg-ischia-leaf px-4 py-2 text-sm font-bold text-white"
            onClick={() => actions.onRestore!(quote)}
            type="button"
          >
            Ripristina
          </button>
        ) : null}
        {actions?.onExcludeToggle && !isDeleted ? (
          <button
            className="rounded-full bg-white px-4 py-2 text-sm font-bold text-amber-700 ring-1 ring-amber-200"
            onClick={() => actions.onExcludeToggle!(quote)}
            type="button"
          >
            {quote.excludedFromStats ? "Reincludi nelle statistiche" : "Escludi dalle statistiche"}
          </button>
        ) : null}
        {actions?.onDelete && !isDeleted ? (
          <button
            className="rounded-full bg-rose-50 px-4 py-2 text-sm font-bold text-rose-700 ring-1 ring-rose-100"
            onClick={() => actions.onDelete!(quote)}
            type="button"
          >
            Cancella
          </button>
        ) : null}
      </div>
      {!isDeleted ? (
        <p className="mt-4 text-xs leading-relaxed text-ischia-ink/58">
          Ultima apertura: {stats.lastOpening ? formatDateTime(stats.lastOpening) : "non ancora aperto"} - Click WhatsApp: <span className="tabular-nums">{stats.whatsappClicks}</span>
        </p>
      ) : null}
    </article>
  );
}

function getQuotePriceLabel(quote: Quote): string {
  if (quote.confirmation?.selectedPrice != null && quote.confirmation.selectedPrice > 0) {
    return formatCurrency(quote.confirmation.selectedPrice);
  }

  if (quote.totalPrice > 0) {
    return formatCurrency(quote.totalPrice);
  }

  const prices = Array.from(new Set(
    getEffectiveHotelOptions(quote)
      .flatMap((option) => option.treatments.map((treatment) => treatment.price))
      .filter((price) => price > 0)
  )).sort((a, b) => a - b);

  if (prices.length === 0) return "Non indicato";
  if (prices.length === 1) return formatCurrency(prices[0]);
  return `${formatCurrency(prices[0])} - ${formatCurrency(prices[prices.length - 1])}`;
}

function Info({ label, value, className = "", numeric = false }: { label: string; value: string; className?: string; numeric?: boolean }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <dt className="text-xs font-bold uppercase tracking-[0.12em] text-ischia-blue/75">{label}</dt>
      <dd className={`mt-1 break-words font-semibold leading-snug text-ischia-ink ${numeric ? "tabular-nums" : ""}`}>{value}</dd>
    </div>
  );
}
