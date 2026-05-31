"use client";

import { useMemo, useState } from "react";
import { adminApiHeaders } from "@/lib/admin-api-client";
import { availabilityStatusLabel, defaultUnavailabilityMessage, formatDepositDueLocalInput } from "@/lib/confirmation-availability";
import { Quote } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";

export function ConfirmationAvailabilityPanel({ quote }: { quote: Quote }) {
  const confirmation = quote.confirmation;
  const [message, setMessage] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [depositDueAt, setDepositDueAt] = useState(formatDepositDueLocalInput());
  const [finalNotes, setFinalNotes] = useState("");
  const [unavailableReason, setUnavailableReason] = useState("");
  const [alternativeToPropose, setAlternativeToPropose] = useState(false);
  const [unavailableMessage, setUnavailableMessage] = useState(defaultUnavailabilityMessage(quote.customerFirstName, quote.code));

  const confirmationId = confirmation?.id;
  const status = confirmation?.availabilityStatus ?? "availability_to_check";
  const canSendFinal = status === "availability_confirmed";
  const selectedPrice = confirmation?.selectedPrice ?? quote.totalPrice;
  const depositAmount = confirmation?.selectedDepositAmount;
  const balanceAmount = confirmation?.selectedBalanceAmount;

  const paymentSnapshot = confirmation?.paymentSettingsSnapshot ?? {};
  const paymentReason = typeof paymentSnapshot.payment_reason === "string" ? paymentSnapshot.payment_reason : "";
  const hasCoordinates = paymentSnapshot.configured === true;

  const depositDueIso = useMemo(() => {
    const parsed = new Date(depositDueAt);
    return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
  }, [depositDueAt]);

  if (!confirmation || !confirmationId) return null;

  async function postAction(path: string, body: Record<string, unknown>, success: string) {
    setLoadingAction(path);
    setMessage(null);
    const response = await fetch(`/api/quote-confirmations/${confirmationId}/${path}`, {
      method: "POST",
      headers: adminApiHeaders(),
      body: JSON.stringify(body)
    });
    const result = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
    setLoadingAction(null);
    if (!response.ok || !result?.ok) {
      setMessage(result?.error ?? "Operazione non riuscita");
      return;
    }
    setMessage(success);
    window.location.reload();
  }

  return (
    <section className="rounded-2xl bg-white/90 p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-ischia-navy">Verifica disponibilità struttura</h2>
          <p className="mt-1 text-sm text-ischia-ink/65">La conferma cliente non è ancora prenotazione definitiva.</p>
        </div>
        <span className="rounded-full bg-ischia-mist px-3 py-1 text-xs font-black text-ischia-navy ring-1 ring-ischia-blue/15">
          {availabilityStatusLabel(status)}
        </span>
      </div>

      {message ? <p className="mt-3 rounded-xl bg-ischia-mist p-3 text-sm font-bold text-ischia-navy">{message}</p> : null}

      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <Info label="Hotel scelto" value={confirmation.selectedHotelName ?? quote.proposedHotel.name} />
        <Info label="Trattamento" value={confirmation.selectedTreatmentLabel ?? (quote.treatment || "-")} />
        <Info label="Prezzo" value={selectedPrice > 0 ? formatCurrency(selectedPrice) : "-"} />
        <Info label="Caparra" value={depositAmount != null ? `${confirmation.selectedDepositPercent ?? 0}% = ${formatCurrency(depositAmount)}` : "-"} />
        <Info label="Saldo" value={balanceAmount != null ? formatCurrency(balanceAmount) : "-"} />
        <Info label="Date" value={`${formatDate(quote.arrivalDate)} - ${formatDate(quote.departureDate)}`} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          className="rounded-full bg-ischia-leaf px-4 py-2 text-sm font-black text-white disabled:opacity-60"
          disabled={Boolean(loadingAction)}
          onClick={() => void postAction("availability-confirmed", {}, "Disponibilità struttura confermata.")}
          type="button"
        >
          Disponibilità confermata
        </button>
        <button
          className="rounded-full bg-rose-50 px-4 py-2 text-sm font-black text-rose-700 ring-1 ring-rose-100 disabled:opacity-60"
          disabled={Boolean(loadingAction)}
          onClick={() => void postAction("availability-unavailable", { reason: unavailableReason, alternativeToPropose }, "Disponibilità segnata come terminata.")}
          type="button"
        >
          Disponibilità terminata
        </button>
      </div>

      {canSendFinal ? (
        <div className="mt-5 rounded-2xl bg-emerald-50/60 p-4 ring-1 ring-emerald-200/70">
          <h3 className="font-black text-ischia-navy">Invia conferma definitiva al cliente</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold text-ischia-ink">
              Scadenza caparra
              <input className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2" type="datetime-local" value={depositDueAt} onChange={(event) => setDepositDueAt(event.target.value)} />
            </label>
            <label className="text-sm font-semibold text-ischia-ink sm:col-span-2">
              Note per il cliente
              <textarea className="mt-1 min-h-20 w-full rounded-xl border border-ischia-blue/20 px-3 py-2" value={finalNotes} onChange={(event) => setFinalNotes(event.target.value)} />
            </label>
          </div>
          <div className="mt-3 rounded-xl bg-white p-3 text-sm text-ischia-ink/75 ring-1 ring-emerald-200/60">
            {hasCoordinates ? (
              <>
                <p><strong>Coordinate snapshot:</strong> {String(paymentSnapshot.bank_account_holder ?? "-")} · {String(paymentSnapshot.iban ?? "-")}</p>
                {paymentReason ? <p><strong>Causale:</strong> {paymentReason}</p> : null}
              </>
            ) : (
              <p className="font-semibold text-amber-800">Coordinate pagamento non configurate: la mail avviserà che verranno comunicate dallo staff.</p>
            )}
          </div>
          <button
            className="mt-3 rounded-full bg-ischia-navy px-4 py-2 text-sm font-black text-white disabled:opacity-60"
            disabled={Boolean(loadingAction) || !depositDueIso}
            onClick={() => void postAction("send-final-confirmation", { depositDueAt: depositDueIso, notes: finalNotes }, "Conferma definitiva inviata al cliente.")}
            type="button"
          >
            Invia conferma definitiva al cliente
          </button>
        </div>
      ) : null}

      <div className="mt-5 rounded-2xl bg-rose-50/70 p-4 ring-1 ring-rose-100">
        <h3 className="font-black text-ischia-navy">Comunica disponibilità terminata al cliente</h3>
        <label className="mt-3 block text-sm font-semibold text-ischia-ink">
          Motivo / nota
          <input className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2" value={unavailableReason} onChange={(event) => setUnavailableReason(event.target.value)} />
        </label>
        <label className="mt-3 block text-sm font-semibold text-ischia-ink">
          Testo email
          <textarea className="mt-1 min-h-52 w-full rounded-xl border border-ischia-blue/20 px-3 py-2" value={unavailableMessage} onChange={(event) => setUnavailableMessage(event.target.value)} />
        </label>
        <label className="mt-3 flex gap-3 text-sm font-semibold text-ischia-ink">
          <input checked={alternativeToPropose} className="mt-1 h-4 w-4" onChange={(event) => setAlternativeToPropose(event.target.checked)} type="checkbox" />
          Segna come alternativa da proporre
        </label>
        <button
          className="mt-3 rounded-full bg-rose-600 px-4 py-2 text-sm font-black text-white disabled:opacity-60"
          disabled={Boolean(loadingAction) || !unavailableMessage.trim()}
          onClick={() => void postAction("send-unavailability-email", { reason: unavailableReason, message: unavailableMessage, alternativeToPropose }, "Email disponibilità terminata inviata.")}
          type="button"
        >
          Invia email disponibilità terminata
        </button>
      </div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-ischia-mist p-3">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-ischia-blue/75">{label}</p>
      <p className="mt-1 font-semibold text-ischia-ink">{value}</p>
    </div>
  );
}
