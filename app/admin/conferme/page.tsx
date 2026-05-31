import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";
import { availabilityStatusLabel, availabilityStatusLabels } from "@/lib/confirmation-availability";
import { listQuotes } from "@/lib/repositories/quotes";
import { ConfirmationAvailabilityStatus } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const filters = ["tutte", "availability_to_check", "availability_confirmed", "deposit_waiting", "availability_unavailable", "alternative_to_propose"] as const;
type Filter = (typeof filters)[number];

export default async function ConfirmationsPage({ searchParams }: { searchParams?: { filter?: string } }) {
  const selectedFilter = filters.includes(searchParams?.filter as Filter) ? searchParams?.filter as Filter : "tutte";
  const result = await listQuotes();
  const confirmations = result.data
    .filter((quote) => quote.confirmation && !quote.deletedAt)
    .filter((quote) => selectedFilter === "tutte" || (quote.confirmation?.availabilityStatus ?? "availability_to_check") === selectedFilter);

  return (
    <AdminShell title="Conferme cliente" subtitle="Verifica manuale disponibilità struttura e invio comunicazioni definitive.">
      <div className="mb-5 flex flex-wrap gap-2">
        {filters.map((filter) => (
          <Link
            key={filter}
            className={`rounded-full px-4 py-2 text-sm font-black ring-1 ${selectedFilter === filter ? "bg-ischia-navy text-white ring-ischia-navy" : "bg-white text-ischia-navy ring-ischia-blue/20"}`}
            href={`/admin/conferme?filter=${filter}`}
          >
            {filter === "tutte" ? "Tutte" : availabilityStatusLabel(filter)}
          </Link>
        ))}
      </div>

      <div className="grid gap-4">
        {confirmations.map((quote) => {
          const confirmation = quote.confirmation!;
          const status = (confirmation.availabilityStatus ?? "availability_to_check") as ConfirmationAvailabilityStatus;
          return (
            <article key={quote.id} className="rounded-2xl bg-white/90 p-5 shadow-soft">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.14em] text-ischia-blue">{quote.code}</p>
                  <h2 className="text-xl font-black text-ischia-navy">{quote.customerFirstName} {quote.customerLastName}</h2>
                </div>
                <span className="rounded-full bg-ischia-mist px-3 py-1 text-xs font-black text-ischia-navy ring-1 ring-ischia-blue/15">
                  {availabilityStatusLabels[status]}
                </span>
              </div>
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <Info label="Hotel scelto" value={confirmation.selectedHotelName ?? quote.proposedHotel.name} />
                <Info label="Trattamento" value={confirmation.selectedTreatmentLabel ?? (quote.treatment || "-")} />
                <Info label="Prezzo" value={confirmation.selectedPrice != null ? formatCurrency(confirmation.selectedPrice) : "vedi preventivo"} />
                <Info label="Date" value={`${formatDate(quote.arrivalDate)} - ${formatDate(quote.departureDate)}`} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link className="rounded-full bg-ischia-navy px-4 py-2 text-sm font-black text-white" href={`/admin/preventivi/${quote.code}`}>
                  Apri dettaglio
                </Link>
              </div>
            </article>
          );
        })}
        {!confirmations.length ? (
          <div className="rounded-2xl bg-white/90 p-6 text-sm font-semibold text-ischia-ink/70 shadow-soft">
            Nessuna conferma per questo filtro.
          </div>
        ) : null}
      </div>
    </AdminShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-ischia-blue/75">{label}</p>
      <p className="mt-1 font-semibold text-ischia-ink">{value}</p>
    </div>
  );
}
