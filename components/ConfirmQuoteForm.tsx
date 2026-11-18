"use client";

import { useState, type Ref } from "react";
import type { PublicQuoteDTO } from "@/lib/public-quote-dto";
import type { QuoteRoomSelection } from "@/lib/types";
import { formatCurrency, ischiastarsWhatsappNumber } from "@/lib/utils";

function todayRomeDateString() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function isOfferExpired(offerExpiresAt: string | null | undefined) {
  return Boolean(offerExpiresAt && offerExpiresAt < todayRomeDateString());
}

export function ConfirmQuoteForm({ quote, selectedRooms = [], confirmationFieldsRef }: {
  quote: PublicQuoteDTO;
  selectedRooms?: QuoteRoomSelection[];
  confirmationFieldsRef?: Ref<HTMLHeadingElement>;
}) {
  const english = quote.customerLanguage === "en";
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
  const expiredOffer = isOfferExpired(quote.offerExpiresAt);

  if (confirmed) {
    return (
      <div className="rounded-2xl bg-emerald-50 p-5 text-emerald-900 ring-1 ring-emerald-200">
        <h3 className="text-2xl font-black">{english ? "Thank you! We received your booking request." : "Grazie, abbiamo ricevuto la tua preferenza."}</h3>
        <p className="mt-2 text-sm leading-6">
          {english ? "Our team will check availability with your chosen hotel and contact you to complete the booking." : "Il nostro staff verificherà la disponibilità definitiva della struttura scelta e ti ricontatterà a breve per completare la prenotazione."}
        </p>
        {whatsappNumber ? (
          <a
            className="mt-4 inline-flex rounded-full bg-[#25D366] px-6 py-3 font-semibold text-white"
            href={`https://wa.me/${whatsappNumber}`}
            rel="noopener noreferrer"
            target="_blank"
          >
            {english ? "Contact us on WhatsApp" : "Scrivici su WhatsApp"}
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
            if (!response.ok || !payload?.ok) throw new Error(english ? "We couldn’t submit your request. Check your details and try again." : (payload?.error ?? "Non siamo riusciti a salvare la conferma"));
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
      <p className="text-sm leading-6 text-ischia-ink/70">{english ? "Enter your details to request this stay. Our team will verify availability." : "Completa i dati per confermare questa proposta. IschiaStars verificherà la disponibilità con la struttura prima dei passaggi definitivi."}</p>
      {expiredOffer ? (
        <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 ring-1 ring-amber-200">
          {english ? "This quote has expired. You can still tell us your preference, and we’ll check availability and pricing before booking." : "Questo preventivo risulta scaduto, ma puoi comunque confermare la tua preferenza. Prima della prenotazione definitiva verificheremo disponibilità, prezzo e condizioni aggiornate."}
        </div>
      ) : null}

      {/* Riepilogo selezione */}
      {selectedOption && (
        <div className="rounded-xl bg-ischia-mist p-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-ischia-blue">{english ? "Your selection" : "Stai confermando"}</p>
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
                <p key={`${room.optionId}-${index}`}><strong>{english ? "Room" : "Camera"} {index + 1}:</strong> {room.roomTypeLabel || "Camera standard"}, {room.treatmentLabel} - {formatCurrency(room.price)}</p>
              ))}
              <p className="pt-1 font-black text-ischia-navy">Totale: {formatCurrency(totalPrice)} - Acconto: {formatCurrency(totalDeposit)} - Saldo: {formatCurrency(totalBalance)}</p>
            </div>
          ) : null}
        </div>
      )}

      {selectedOption ? (
        <div className="rounded-xl bg-white p-4 text-sm leading-6 text-ischia-ink/78 ring-1 ring-ischia-blue/10">
          <p className="font-black text-ischia-navy">{english ? "Payment summary" : "Riepilogo pagamento"}</p>
          <p><strong>{english ? "Total price:" : "Prezzo totale:"}</strong> {formatCurrency(totalPrice)}</p>
          {selectedOption.depositPercent != null && selectedOption.depositPercent > 0 ? (
            <>
              <p><strong>{english ? "Deposit:" : "Caparra richiesta:"}</strong> {formatCurrency(totalDeposit)}</p>
              <p><strong>{english ? "Remaining balance:" : "Saldo restante:"}</strong> {formatCurrency(totalBalance)}</p>
            </>
          ) : null}
          {selectedOption.balanceMethod ? <p><strong>{english ? "Balance:" : "Saldo:"}</strong> {selectedOption.balanceMethod}</p> : null}
          {selectedOption.cancellationPolicy ? <p><strong>{english ? "Cancellation policy:" : "Policy cancellazione:"}</strong> {selectedOption.cancellationPolicy}</p> : null}
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 font-semibold text-amber-900">
            {english ? "We’ll send deposit payment instructions once the hotel confirms availability." : "Le coordinate per il versamento della caparra saranno inviate solo dopo la verifica della disponibilità con la struttura."}
          </p>
        </div>
      ) : null}

      <h3 ref={confirmationFieldsRef} tabIndex={-1} className="scroll-mt-4 rounded-xl bg-ischia-sun px-4 py-3 text-lg font-bold leading-snug text-ischia-navy sm:px-5 sm:text-xl">
        {english ? "Enter your personal details" : "Compila il modulo con tutti i tuoi dati anagrafici"}
      </h3>

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
        <Input required name="firstName" label={english ? "First name" : "Nome"} defaultValue={quote.customerFirstName} />
        <Input required name="lastName" label={english ? "Last name" : "Cognome"} defaultValue={quote.customerLastName} />
        <Input required name="phone" label={english ? "WhatsApp phone number" : "Telefono WhatsApp"} defaultValue={quote.customerPhone} />
        <Input required name="email" label="Email" type="email" defaultValue={quote.customerEmail} />
        <Input required={!english} name="fiscalCode" label={english ? "Italian tax code (if applicable)" : "Codice fiscale"} minLength={english ? undefined : 11} />
        <Input required name="address" label={english ? "Street address" : "Indirizzo di residenza"} />
        <Input required name="city" label={english ? "City" : "Città"} />
        <Input required name="postalCode" label={english ? "ZIP or postal code" : "CAP"} pattern={english ? undefined : "[0-9]{5}"} />
        <Input required name="province" label={english ? "State or province" : "Provincia"} />
      </div>

      {quote.children.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-black text-ischia-navy">{english ? "Children’s details" : "Dati bambini"}</p>
          {quote.children.map((child, index) => (
            <div key={child.id} className="rounded-xl bg-ischia-mist p-4">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-ischia-blue">{english ? "Child" : "Bambino"} {index + 1}</p>
              {child.age != null && (
                <p className="mt-1 text-sm text-ischia-ink/70">
                  Età indicata nel preventivo: <strong>{child.age} {child.age === 1 ? "anno" : "anni"}</strong>
                </p>
              )}
              <div className="mt-2">
                <Input required name={`child-${child.id}`} label={english ? "Date of birth *" : "Data di nascita *"} type="date" />
              </div>
            </div>
          ))}
        </div>
      )}

      <label className="flex gap-3 text-sm text-ischia-ink/78">
        <input required name="acceptedTerms" type="checkbox" className="mt-1 h-4 w-4" />
        {english ? "I agree to the offer, payment, and cancellation terms." : "Accetto condizioni della proposta, pagamento e cancellazione."}
      </label>
      <label className="flex gap-3 text-sm text-ischia-ink/78">
        <input required name="acceptedPrivacy" type="checkbox" className="mt-1 h-4 w-4" />
        {english ? "I agree to the privacy terms and processing of my personal data." : "Accetto privacy e trattamento dati personali."}
      </label>

      <button
        className="focus-ring justify-self-center rounded-full bg-ischia-sun px-5 py-2.5 text-sm font-bold leading-5 text-ischia-navy disabled:cursor-not-allowed disabled:opacity-60"
        disabled={loading || !canSubmit}
        type="submit"
      >
        {loading
          ? (english ? "Sending…" : "Invio in corso...")
          : !canSubmit
            ? (english ? "Choose an option first" : "Seleziona prima una proposta")
            : (english ? "Send booking request" : "Invia richiesta di prenotazione")}
      </button>
      <p className="text-center text-xs leading-5 text-ischia-ink/70">
        {english ? "We’ll confirm availability before requesting a deposit." : "Confermeremo la disponibilità prima di richiedere la caparra."}
      </p>
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
