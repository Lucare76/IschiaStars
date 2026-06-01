"use client";

import { useMemo, useState } from "react";
import { adminApiHeaders } from "@/lib/admin-api-client";
import { availabilityStatusLabel, defaultUnavailabilityMessage, formatDepositDueLocalInput } from "@/lib/confirmation-availability";
import { buildPaymentReason, isPaymentSettingsConfigured, PaymentSettings } from "@/lib/payment-settings";
import { Quote } from "@/lib/types";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";

export function ConfirmationAvailabilityPanel({ quote, paymentSettings }: { quote: Quote; paymentSettings: PaymentSettings }) {
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

  const finalPaymentSnapshot = confirmation?.finalConfirmationSentAt ? confirmation?.paymentSettingsSnapshot ?? {} : {};
  const finalPaymentReason = typeof finalPaymentSnapshot.payment_reason === "string" ? finalPaymentSnapshot.payment_reason : "";
  const hasFinalCoordinates = finalPaymentSnapshot.configured === true;
  const hasCurrentCoordinates = isPaymentSettingsConfigured(paymentSettings);
  const confirmationChildren = getConfirmationChildren(confirmation?.metadata, quote.children);
  const confirmationName = `${confirmation?.firstName ?? quote.customerFirstName} ${confirmation?.lastName ?? quote.customerLastName}`.trim();
  const addressLine = [confirmation?.address, confirmation?.zip, confirmation?.city, confirmation?.province].filter(Boolean).join(" ");
  const currentPaymentReason = buildPaymentReason(
    paymentSettings,
    quote.code,
    confirmation?.firstName ?? quote.customerFirstName,
    confirmation?.lastName ?? quote.customerLastName
  );

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
    <section id="verifica-disponibilita" className="rounded-2xl bg-white/90 p-5 shadow-soft">
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
        <Info label="Nome cliente" value={confirmationName || "-"} />
        <Info label="Telefono" value={confirmation.phone ?? quote.customerPhone ?? "-"} />
        <Info label="Email" value={confirmation.email ?? quote.customerEmail ?? "-"} />
        <Info label="Codice fiscale" value={confirmation.fiscalCode || "-"} />
        <Info label="Indirizzo" value={addressLine || "-"} />
        <Info label="Bambini / età" value={confirmationChildren} />
        <Info label="Hotel scelto" value={confirmation.selectedHotelName ?? quote.proposedHotel.name} />
        <Info label="Trattamento" value={confirmation.selectedTreatmentLabel ?? (quote.treatment || "-")} />
        <Info label="Prezzo" value={selectedPrice > 0 ? formatCurrency(selectedPrice) : "-"} />
        <Info label="Caparra" value={depositAmount != null ? `${confirmation.selectedDepositPercent ?? 0}% = ${formatCurrency(depositAmount)}` : "-"} />
        <Info label="Saldo" value={balanceAmount != null ? formatCurrency(balanceAmount) : "-"} />
        <Info label="Coordinate" value={hasCurrentCoordinates ? "Configurate per invio definitivo" : "Non configurate"} />
        <Info label="Causale" value={currentPaymentReason || "-"} />
        <Info label="Policy cancellazione" value={confirmation.selectedCancellationPolicy ?? quote.cancellationPolicy ?? "-"} />
        <Info label="Confermata il" value={formatDateTime(confirmation.confirmedAt)} />
        <Info label="Date" value={`${formatDate(quote.arrivalDate)} - ${formatDate(quote.departureDate)}`} />
      </div>

      <div className="mt-4 rounded-2xl bg-ischia-mist p-4 text-sm text-ischia-ink">
        <h3 className="font-black text-ischia-navy">Coordinate pagamento</h3>
        {hasFinalCoordinates ? (
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <Info label="Snapshot inviato" value="Coordinate salvate nella conferma definitiva" />
            <Info label="Intestatario" value={String(finalPaymentSnapshot.bank_account_holder ?? "-")} />
            <Info label="Banca" value={String(finalPaymentSnapshot.bank_name ?? "-")} />
            <Info label="IBAN" value={String(finalPaymentSnapshot.iban ?? "-")} />
            <Info label="BIC/SWIFT" value={String(finalPaymentSnapshot.bic_swift ?? "-")} />
            <Info label="Causale" value={finalPaymentReason || "-"} />
          </div>
        ) : hasCurrentCoordinates ? (
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <Info label="Intestatario" value={paymentSettings.bankAccountHolder || "-"} />
            <Info label="Banca" value={paymentSettings.bankName || "-"} />
            <Info label="IBAN" value={paymentSettings.iban || "-"} />
            <Info label="BIC/SWIFT" value={paymentSettings.bicSwift || "-"} />
            <Info label="Causale" value={currentPaymentReason || "-"} />
            <Info label="Istruzioni" value={paymentSettings.paymentInstructions || "-"} />
          </div>
        ) : (
          <p className="mt-2 font-semibold text-amber-800">Coordinate pagamento non configurate. Vai in Impostazioni.</p>
        )}
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
          {!hasCurrentCoordinates ? (
            <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900 ring-1 ring-amber-200">
              Coordinate pagamento non configurate. Vai in Impostazioni.
            </p>
          ) : null}
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
            {hasCurrentCoordinates ? (
              <>
                <p><strong>Coordinate che verranno inviate:</strong> {paymentSettings.bankAccountHolder} · {paymentSettings.iban}</p>
                {paymentSettings.bankName ? <p><strong>Banca:</strong> {paymentSettings.bankName}</p> : null}
                {paymentSettings.bicSwift ? <p><strong>BIC/SWIFT:</strong> {paymentSettings.bicSwift}</p> : null}
                <p><strong>Causale:</strong> {currentPaymentReason}</p>
                {paymentSettings.paymentInstructions ? <p><strong>Istruzioni:</strong> {paymentSettings.paymentInstructions}</p> : null}
              </>
            ) : (
              <p className="font-semibold text-amber-800">Coordinate pagamento non configurate. Completa le impostazioni prima di inviare la conferma definitiva.</p>
            )}
          </div>
          <button
            className="mt-3 rounded-full bg-ischia-navy px-4 py-2 text-sm font-black text-white disabled:opacity-60"
            disabled={Boolean(loadingAction) || !depositDueIso || !hasCurrentCoordinates}
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

function getConfirmationChildren(metadata: Record<string, unknown> | undefined, fallbackChildren: { birthDate?: string }[]) {
  const metadataChildren = Array.isArray(metadata?.children) ? metadata.children : [];
  const children = metadataChildren.length ? metadataChildren : fallbackChildren;
  const labels = children
    .map((child, index) => {
      if (!child || typeof child !== "object") return null;
      const birthDate = "birthDate" in child && typeof child.birthDate === "string" ? child.birthDate : "";
      if (!birthDate) return null;
      return `Bambino ${index + 1}: ${birthDate}`;
    })
    .filter(Boolean);
  return labels.length ? labels.join(" · ") : "-";
}
