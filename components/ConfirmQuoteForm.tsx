"use client";

import { useState } from "react";
import { buildPaymentReason, isPaymentSettingsConfigured, PaymentSettings } from "@/lib/payment-settings";
import { Quote } from "@/lib/types";
import { formatCurrency, publicWhatsappLink } from "@/lib/utils";

type SelectedOption = {
  optionId: string;
  hotelName: string;
  treatmentKey: string;
  treatmentLabel: string;
  price: number;
  depositPercent?: number;
  depositAmount?: number;
  balanceAmount?: number;
  balanceMethod?: string;
  paymentPolicy?: string;
  cancellationPolicy?: string;
};

export function ConfirmQuoteForm({ quote, selectedOption, paymentSettings }: { quote: Quote; selectedOption?: SelectedOption | null; paymentSettings?: PaymentSettings }) {
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasPaymentSettings = paymentSettings ? isPaymentSettingsConfigured(paymentSettings) : false;
  const paymentReason = paymentSettings
    ? buildPaymentReason(paymentSettings, quote.code, quote.customerFirstName, quote.customerLastName)
    : "";

  if (confirmed) {
    return (
      <div className="rounded-2xl bg-emerald-50 p-5 text-emerald-900 ring-1 ring-emerald-200">
        <h3 className="text-xl font-black">Preventivo confermato</h3>
        <p className="mt-2 text-sm">Grazie, il preventivo e stato confermato correttamente. IschiaStars ti contattera per i prossimi passaggi.</p>
        <a
          className="mt-4 inline-flex rounded-full bg-ischia-leaf px-4 py-2 text-sm font-black text-white"
          href={publicWhatsappLink(`Ciao IschiaStars, ho confermato il preventivo ${quote.code}.`)}
        >
          Scrivi su WhatsApp
        </a>
      </div>
    );
  }

  return (
    <form
      className="grid gap-3 rounded-2xl bg-white p-5 shadow-soft"
      onSubmit={(event) => {
        event.preventDefault();
        if (loading) return;
        setLoading(true);
        setError(null);
        const formData = new FormData(event.currentTarget);
        void fetch("/api/quote-confirmations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quoteCode: quote.code,
            token: quote.token,
            firstName: String(formData.get("firstName") ?? ""),
            lastName: String(formData.get("lastName") ?? ""),
            fiscalCode: String(formData.get("fiscalCode") ?? ""),
            phone: String(formData.get("phone") ?? ""),
            email: String(formData.get("email") ?? ""),
            address: String(formData.get("address") ?? ""),
            city: String(formData.get("city") ?? ""),
            postalCode: String(formData.get("postalCode") ?? ""),
            province: String(formData.get("province") ?? ""),
            acceptedTerms: formData.get("acceptedTerms") === "on",
            acceptedPrivacy: formData.get("acceptedPrivacy") === "on",
            children: quote.children.map((child) => ({ id: child.id, birthDate: String(formData.get(`child-${child.id}`) ?? "") })),
            selectedHotelOptionId: selectedOption?.optionId,
            selectedHotelName: selectedOption?.hotelName,
            selectedTreatmentKey: selectedOption?.treatmentKey,
            selectedTreatmentLabel: selectedOption?.treatmentLabel,
            selectedPrice: selectedOption?.price
          })
        })
          .then(async (response) => {
            const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
            if (!response.ok || !payload?.ok) throw new Error(payload?.error ?? "Non siamo riusciti a salvare la conferma");
            setConfirmed(true);
          })
          .catch((submitError: unknown) => {
            setError(submitError instanceof Error ? submitError.message : "Errore durante la conferma");
          })
          .finally(() => {
            setLoading(false);
          });
      }}
    >
      <h3 className="text-2xl font-black text-ischia-navy">Conferma il preventivo</h3>
      <p className="text-sm leading-6 text-ischia-ink/70">Completa i dati per bloccare questa proposta. IschiaStars ti ricontattera per acconto e dettagli operativi.</p>

      {/* Riepilogo selezione */}
      {selectedOption && (
        <div className="rounded-xl bg-ischia-mist p-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-ischia-blue">Stai confermando</p>
          <p className="mt-1 text-lg font-black text-ischia-navy">{selectedOption.hotelName}</p>
          <p className="text-sm font-semibold text-ischia-ink/80">{selectedOption.treatmentLabel} — {formatCurrency(selectedOption.price)}</p>
          {selectedOption.depositPercent != null && selectedOption.depositPercent > 0 ? (
            <p className="mt-1 text-sm font-semibold text-ischia-ink/72">
              Acconto {selectedOption.depositPercent}%: {formatCurrency(selectedOption.depositAmount ?? 0)} · Saldo {formatCurrency(selectedOption.balanceAmount ?? 0)}
            </p>
          ) : null}
        </div>
      )}

      {selectedOption ? (
        <div className="rounded-xl bg-white p-4 text-sm leading-6 text-ischia-ink/78 ring-1 ring-ischia-blue/10">
          <p className="font-black text-ischia-navy">Riepilogo pagamento</p>
          <p><strong>Prezzo totale:</strong> {formatCurrency(selectedOption.price)}</p>
          {selectedOption.depositPercent != null && selectedOption.depositPercent > 0 ? (
            <>
              <p><strong>Caparra richiesta:</strong> {selectedOption.depositPercent}% = {formatCurrency(selectedOption.depositAmount ?? 0)}</p>
              <p><strong>Saldo restante:</strong> {formatCurrency(selectedOption.balanceAmount ?? 0)}</p>
            </>
          ) : null}
          {selectedOption.balanceMethod ? <p><strong>Saldo:</strong> {selectedOption.balanceMethod}</p> : null}
          {hasPaymentSettings && paymentSettings ? (
            <div className="mt-3 border-t border-ischia-blue/10 pt-3">
              <p className="font-bold text-ischia-navy">Coordinate per caparra</p>
              <p><strong>Intestatario:</strong> {paymentSettings.bankAccountHolder}</p>
              {paymentSettings.bankName ? <p><strong>Banca:</strong> {paymentSettings.bankName}</p> : null}
              <p><strong>IBAN:</strong> {paymentSettings.iban}</p>
              {paymentSettings.bicSwift ? <p><strong>BIC/SWIFT:</strong> {paymentSettings.bicSwift}</p> : null}
              <p><strong>Causale:</strong> {paymentReason}</p>
              {paymentSettings.paymentInstructions ? <p>{paymentSettings.paymentInstructions}</p> : null}
            </div>
          ) : (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 font-semibold text-amber-900">
              Le modalità di pagamento della caparra saranno comunicate dallo staff IschiaStars.
            </p>
          )}
        </div>
      ) : null}

      {!selectedOption && (
        <div className="rounded-xl bg-ischia-sun/15 px-4 py-3 text-sm font-semibold text-amber-900">
          Scegli un trattamento dalle proposte qui sopra cliccando su &quot;Conferma questa opzione&quot;, oppure conferma il preventivo in modo generico.
        </div>
      )}

      {error ? <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700 ring-1 ring-rose-100">{error}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Input required name="firstName" label="Nome" defaultValue={quote.customerFirstName} />
        <Input required name="lastName" label="Cognome" defaultValue={quote.customerLastName} />
        <Input required name="fiscalCode" label="Codice fiscale" minLength={11} />
        <Input required name="phone" label="Telefono WhatsApp" defaultValue={quote.customerPhone} />
        <Input required name="email" label="Email" type="email" defaultValue={quote.customerEmail} />
        <Input required name="address" label="Indirizzo di residenza" />
        <Input required name="city" label="Citta" />
        <Input required name="postalCode" label="CAP" pattern="[0-9]{5}" />
        <Input required name="province" label="Provincia" />
      </div>

      {quote.children.map((child, index) => (
        <Input key={child.id} required name={`child-${child.id}`} label={`Data di nascita bambino ${index + 1}`} type="date" defaultValue={child.birthDate} />
      ))}

      <label className="flex gap-3 text-sm text-ischia-ink/78">
        <input required name="acceptedTerms" type="checkbox" className="mt-1 h-4 w-4" />
        Accetto condizioni della proposta, pagamento e cancellazione.
      </label>
      <label className="flex gap-3 text-sm text-ischia-ink/78">
        <input required name="acceptedPrivacy" type="checkbox" className="mt-1 h-4 w-4" />
        Accetto privacy e trattamento dati personali.
      </label>

      <button
        className="focus-ring rounded-full bg-ischia-sun px-5 py-3 font-black text-ischia-navy disabled:cursor-not-allowed disabled:opacity-60"
        disabled={loading}
        type="submit"
      >
        {loading ? "Conferma in corso..." : selectedOption ? `Conferma — ${selectedOption.hotelName}` : "Conferma il preventivo"}
      </button>
    </form>
  );
}

function Input({ label, name, type = "text", required, defaultValue, pattern, minLength }: { label: string; name: string; type?: string; required?: boolean; defaultValue?: string; pattern?: string; minLength?: number }) {
  return (
    <label className="block text-sm font-semibold text-ischia-ink">
      {label}
      <input
        className="focus-ring mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2"
        defaultValue={defaultValue}
        minLength={minLength}
        name={name}
        pattern={pattern}
        required={required}
        type={type}
      />
    </label>
  );
}
