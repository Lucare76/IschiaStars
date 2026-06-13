"use client";

import { useState } from "react";
import { Quote, QuoteRoomSelection } from "@/lib/types";
import { formatCurrency, ischiastarsWhatsappNumber } from "@/lib/utils";

export function ConfirmQuoteForm({ quote, selectedRooms = [] }: { quote: Quote; selectedRooms?: QuoteRoomSelection[] }) {
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Se il preventivo ha opzioni hotel esplicite (sistema multi-proposta), la selezione è obbligatoria.
  const requiresSelection = quote.hotelOptions.length > 0;
  const canSubmit = !requiresSelection || selectedRooms.length === quote.rooms;
  const selectedOption = selectedRooms[0];
  const totalPrice = selectedRooms.reduce((sum, room) => sum + room.price, 0);
  const totalDeposit = selectedRooms.reduce((sum, room) => sum + (room.depositAmount ?? 0), 0);
  const totalBalance = selectedRooms.reduce((sum, room) => sum + (room.balanceAmount ?? 0), 0);
  const whatsappNumber = ischiastarsWhatsappNumber();

  if (confirmed) {
    return (
      <div className="rounded-2xl bg-emerald-50 p-5 text-emerald-900 ring-1 ring-emerald-200">
        <h3 className="text-2xl font-black">Grazie, abbiamo ricevuto la tua preferenza.</h3>
        <p className="mt-2 text-sm leading-6">
          Il nostro staff verificherà la disponibilità definitiva della struttura scelta e ti ricontatterà a breve per completare la prenotazione.
        </p>
        {whatsappNumber ? (
          <a
            className="mt-4 inline-flex rounded-full bg-[#25D366] px-6 py-3 font-semibold text-white"
            href={`https://wa.me/${whatsappNumber}`}
            rel="noopener noreferrer"
            target="_blank"
          >
            Scrivici su WhatsApp
          </a>
        ) : null}
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
            selectedRooms
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
      <p className="text-sm leading-6 text-ischia-ink/70">Completa i dati per confermare questa proposta. IschiaStars verifichera la disponibilita con la struttura prima dei passaggi definitivi.</p>

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
          {selectedRooms.length > 1 ? (
            <div className="mt-3 space-y-1 border-t border-ischia-blue/10 pt-3 text-sm text-ischia-ink/80">
              {selectedRooms.map((room, index) => (
                <p key={`${room.optionId}-${index}`}><strong>Camera {index + 1}:</strong> {room.roomTypeLabel || "Camera standard"}, {room.treatmentLabel} - {formatCurrency(room.price)}</p>
              ))}
              <p className="pt-1 font-black text-ischia-navy">Totale: {formatCurrency(totalPrice)} - Acconto: {formatCurrency(totalDeposit)} - Saldo: {formatCurrency(totalBalance)}</p>
            </div>
          ) : null}
        </div>
      )}

      {selectedOption ? (
        <div className="rounded-xl bg-white p-4 text-sm leading-6 text-ischia-ink/78 ring-1 ring-ischia-blue/10">
          <p className="font-black text-ischia-navy">Riepilogo pagamento</p>
          <p><strong>Prezzo totale:</strong> {formatCurrency(totalPrice)}</p>
          {selectedOption.depositPercent != null && selectedOption.depositPercent > 0 ? (
            <>
              <p><strong>Caparra richiesta:</strong> {formatCurrency(totalDeposit)}</p>
              <p><strong>Saldo restante:</strong> {formatCurrency(totalBalance)}</p>
            </>
          ) : null}
          {selectedOption.balanceMethod ? <p><strong>Saldo:</strong> {selectedOption.balanceMethod}</p> : null}
          {selectedOption.cancellationPolicy ? <p><strong>Policy cancellazione:</strong> {selectedOption.cancellationPolicy}</p> : null}
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 font-semibold text-amber-900">
            Le coordinate per il versamento della caparra saranno inviate solo dopo la verifica della disponibilita con la struttura.
          </p>
        </div>
      ) : null}

      {!canSubmit && requiresSelection && (
        <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800 ring-1 ring-rose-200">
          Seleziona tipologia e trattamento per tutte le camere: ne mancano <strong>{quote.rooms - selectedRooms.length}</strong>.
        </div>
      )}
      {!selectedOption && !requiresSelection && (
        <div className="rounded-xl bg-ischia-sun/15 px-4 py-3 text-sm font-semibold text-amber-900">
          Scegli un trattamento dalle proposte qui sopra, oppure conferma il preventivo in modo generico.
        </div>
      )}

      {error ? <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700 ring-1 ring-rose-100">{error}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Input required name="firstName" label="Nome" defaultValue={quote.customerFirstName} />
        <Input required name="lastName" label="Cognome" defaultValue={quote.customerLastName} />
        <Input required name="phone" label="Telefono WhatsApp" defaultValue={quote.customerPhone} />
        <Input required name="email" label="Email" type="email" defaultValue={quote.customerEmail} />
        <Input name="fiscalCode" label="Codice fiscale (facoltativo)" minLength={11} />
        <Input name="address" label="Indirizzo di residenza (facoltativo)" />
        <Input name="city" label="Citta (facoltativo)" />
        <Input name="postalCode" label="CAP (facoltativo)" pattern="[0-9]{5}" />
        <Input name="province" label="Provincia (facoltativo)" />
      </div>

      {quote.children.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-black text-ischia-navy">Dati bambini</p>
          {quote.children.map((child, index) => (
            <div key={child.id} className="rounded-xl bg-ischia-mist p-4">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-ischia-blue">Bambino {index + 1}</p>
              {child.age != null && (
                <p className="mt-1 text-sm text-ischia-ink/70">
                  Età indicata nel preventivo: <strong>{child.age} {child.age === 1 ? "anno" : "anni"}</strong>
                </p>
              )}
              <div className="mt-2">
                <Input required name={`child-${child.id}`} label="Data di nascita *" type="date" />
              </div>
            </div>
          ))}
        </div>
      )}

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
        disabled={loading || !canSubmit}
        type="submit"
      >
        {loading
          ? "Conferma in corso..."
          : selectedOption
            ? `Conferma — ${selectedOption.hotelName}`
            : requiresSelection
              ? "Seleziona prima una proposta"
              : "Conferma il preventivo"}
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
