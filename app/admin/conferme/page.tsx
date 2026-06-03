import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";
import { availabilityStatusLabel, availabilityStatusLabels } from "@/lib/confirmation-availability";
import { isPaymentSettingsConfigured } from "@/lib/payment-settings";
import { listQuotes } from "@/lib/repositories/quotes";
import { getPaymentSettings } from "@/lib/repositories/settings";
import { ConfirmationAvailabilityStatus } from "@/lib/types";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";

type AgeComparison = {
  childIndex: number;
  declaredAge?: number;
  calculatedAge?: number;
  birthDate?: string;
  ageMismatch: boolean;
  difference?: number;
  noData: boolean;
};

export const dynamic = "force-dynamic";

const filters = ["tutte", "availability_to_check", "availability_confirmed", "deposit_waiting", "availability_unavailable", "alternative_to_propose"] as const;
type Filter = (typeof filters)[number];

export default async function ConfirmationsPage({ searchParams }: { searchParams?: { filter?: string } }) {
  const selectedFilter = filters.includes(searchParams?.filter as Filter) ? searchParams?.filter as Filter : "tutte";
  const [result, paymentSettings] = await Promise.all([listQuotes(), getPaymentSettings()]);
  const missingPaymentSettings = !isPaymentSettingsConfigured(paymentSettings.data);
  const confirmations = result.data
    .filter((quote) => quote.confirmation && !quote.deletedAt && !quote.excludedFromStats)
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

      {missingPaymentSettings ? (
        <div className="mb-5 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-900 ring-1 ring-amber-200">
          Coordinate pagamento non configurate. Vai in Impostazioni.
        </div>
      ) : null}

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
                <Info label="Telefono" value={confirmation.phone ?? quote.customerPhone ?? "-"} />
                <Info label="Email" value={confirmation.email ?? quote.customerEmail ?? "-"} />
                <Info label="Hotel scelto" value={confirmation.selectedHotelName ?? quote.proposedHotel.name} />
                <Info label="Trattamento" value={confirmation.selectedTreatmentLabel ?? (quote.treatment || "-")} />
                <Info label="Prezzo" value={confirmation.selectedPrice != null ? formatCurrency(confirmation.selectedPrice) : "vedi preventivo"} />
                <Info label="Caparra" value={confirmation.selectedDepositAmount != null ? formatCurrency(confirmation.selectedDepositAmount) : "-"} />
                <Info label="Confermata il" value={formatDateTime(confirmation.confirmedAt)} />
                <Info label="Date" value={`${formatDate(quote.arrivalDate)} - ${formatDate(quote.departureDate)}`} />
              </div>
              {(() => {
                const meta = confirmation.metadata as Record<string, unknown> | undefined;
                const comparisons = (meta?.children_age_comparison ?? []) as AgeComparison[];
                const mismatches = comparisons.filter((c) => c.ageMismatch);
                if (!mismatches.length) return null;
                return (
                  <div className="mt-4 rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200">
                    <p className="text-sm font-black text-amber-900">Attenzione: età bambini da verificare</p>
                    {mismatches.map((m) => (
                      <p key={m.childIndex} className="mt-1 text-sm text-amber-800">
                        Bambino {m.childIndex}: preventivo {m.declaredAge} anni, data nascita {m.birthDate ? formatDate(m.birthDate) : "—"} → {m.calculatedAge} anni al check-in.{" "}
                        Verificare eventuali differenze tariffarie o condizioni della struttura.
                      </p>
                    ))}
                  </div>
                );
              })()}
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
