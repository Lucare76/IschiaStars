"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent, InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { useState } from "react";
import { CloneQuoteButton } from "@/components/CloneQuoteButton";
import { ConfirmationAvailabilityPanel } from "@/components/ConfirmationAvailabilityPanel";
import {
  HotelOptionState,
  HotelOptionsEditor,
  mapHotelOptionsToPayload,
  quoteOptionsToHotelOptionState,
  suggestedGuestsPerRoom
} from "@/components/HotelOptionsEditor";
import { QuoteStatusBadge } from "@/components/QuoteStatusBadge";
import { WhatsAppSendButton } from "@/components/WhatsAppSendButton";
import { adminApiErrorMessage, adminApiFetch, readAdminApiJson } from "@/lib/admin-api-client";
import { PaymentSettings } from "@/lib/payment-settings";
import { getEffectiveHotelOptions } from "@/lib/repositories/shared";
import { Hotel, Quote, QuoteStatus, TransportOffer } from "@/lib/types";
import { formatCurrency, publicQuoteUrl } from "@/lib/utils";

const statusOptions: QuoteStatus[] = ["in_lavorazione", "confermato", "perso_non_disponibile"];

export function QuoteDetailEditor({ quote, hotels, paymentSettings }: { quote: Quote; hotels: Hotel[]; paymentSettings: PaymentSettings }) {
  const router = useRouter();
  const effective = getEffectiveHotelOptions(quote);
  const [currentQuote, setCurrentQuote] = useState(quote);
  const [adultsCount, setAdultsCount] = useState(quote.adults);
  const [roomsCount, setRoomsCount] = useState(quote.rooms);
  const [hotelOptions, setHotelOptions] = useState<HotelOptionState[]>(quoteOptionsToHotelOptionState(effective));
  const [transportOffers] = useState<TransportOffer[]>(withDefaultTransportOffers(quote.transportOffers));
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [previewOpened, setPreviewOpened] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    const formData = new FormData(event.currentTarget);

    const mappedOptions = mapHotelOptionsToPayload(hotelOptions, { preserveGroups: true });

    const payload = {
      clientFirstName: formData.get("firstName"),
      clientLastName: formData.get("lastName"),
      clientEmail: formData.get("email"),
      clientPhone: formData.get("phone"),
      hotelRequested: formData.get("hotelRequested"),
      hotelId: hotelOptions[0]?.hotelId || undefined,
      checkIn: formData.get("checkIn"),
      checkOut: formData.get("checkOut"),
      adults: Number(formData.get("adults") ?? 2),
      rooms: Number(formData.get("rooms") ?? 1),
      totalPrice: Number(formData.get("totalPrice") ?? 0),
      depositAmount: Number(formData.get("depositAmount") ?? 0),
      validUntil: formData.get("validUntil"),
      transportOffers,
      publicNotes: formData.get("publicNotes"),
      internalNotes: formData.get("internalNotes"),
      hotelOptions: mappedOptions.length > 0 ? mappedOptions : undefined
    };

    const response = await adminApiFetch(`/api/quotes/${currentQuote.id}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
    const result = await readAdminApiJson<{ ok?: boolean; data?: Quote; source?: string; error?: string }>(response);
    setLoading(false);
    if (!response.ok || !result?.ok || !result.data) {
      setMessage(adminApiErrorMessage(response, result, "Salvataggio non riuscito."));
      return;
    }
    setCurrentQuote(result.data);
    setMessage("Preventivo aggiornato.");
    router.refresh();
  }

  async function changeStatus(status: QuoteStatus) {
    const response = await adminApiFetch(`/api/quotes/${currentQuote.id}`, {
      method: "PATCH",
      body: JSON.stringify({ statusOnly: true, status })
    });
    const result = await readAdminApiJson<{ ok?: boolean; data?: Quote; error?: string }>(response);
    if (response.ok && result?.data) {
      setCurrentQuote(result.data);
      router.refresh();
    }
  }

  async function toggleExcludeFromStats() {
    setMessage(null);
    const next = !currentQuote.excludedFromStats;
    if (next) {
      const ok = window.confirm(
        `Vuoi escludere il preventivo ${currentQuote.code} dalle statistiche?\n\nNon verrà conteggiato in dashboard, statistiche e liste operative principali. Potrai reincluderlo in seguito.`
      );
      if (!ok) return;
    }

    const response = await adminApiFetch(`/api/quotes/${currentQuote.id}`, {
      method: "PATCH",
      body: JSON.stringify({ excludedFromStats: next })
    });
    const result = await readAdminApiJson<{ ok?: boolean; data?: Quote; error?: string }>(response);
    if (response.ok && result?.data) {
      setCurrentQuote(result.data);
      setMessage(next ? "Preventivo escluso dalle statistiche." : "Preventivo reinclueso nelle statistiche.");
      router.refresh();
    } else {
      setMessage("Operazione non riuscita.");
    }
  }

  async function deleteCurrentQuote() {
    setMessage(null);
    const ok = window.confirm(`Vuoi cancellare il preventivo ${currentQuote.code}?\n\nVerrà nascosto dalle liste operative e dalle statistiche.`);
    if (!ok) return;
    const response = await adminApiFetch(`/api/quotes/${currentQuote.id}`, {
      method: "PATCH",
      body: JSON.stringify({ softDelete: true })
    });
    const result = await readAdminApiJson<{ ok?: boolean; data?: Quote }>(response);
    if (response.ok && result?.data) {
      setCurrentQuote(result.data);
      setMessage("Preventivo cancellato.");
      router.refresh();
    } else {
      setMessage("Cancellazione non riuscita.");
    }
  }

  async function restoreCurrentQuote() {
    setMessage(null);
    const response = await adminApiFetch(`/api/quotes/${currentQuote.id}`, {
      method: "POST",
      body: JSON.stringify({ action: "restore" })
    });
    const result = await readAdminApiJson<{ ok?: boolean; data?: Quote }>(response);
    if (response.ok && result?.data) {
      setCurrentQuote(result.data);
      setMessage("Preventivo ripristinato.");
      router.refresh();
    } else {
      setMessage("Ripristino non riuscito.");
    }
  }

  async function duplicateCurrentQuote() {
    setMessage(null);
    const response = await adminApiFetch(`/api/quotes/${currentQuote.id}`, {
      method: "POST",
      body: JSON.stringify({ action: "duplicate" })
    });
    const result = await readAdminApiJson<{ ok?: boolean; data?: Quote; error?: string }>(response);
    if (!response.ok || !result?.ok || !result.data) {
      setMessage(adminApiErrorMessage(response, result, "Duplicazione non riuscita."));
      return;
    }
    router.push(`/admin/preventivi/${result.data.code}`);
    router.refresh();
  }

  async function sendQuote() {
    setSending(true);
    setMessage(null);
    const response = await adminApiFetch(`/api/quotes/${currentQuote.id}`, {
      method: "POST",
      body: JSON.stringify({ action: "send" })
    });
    const result = await readAdminApiJson<{ ok?: boolean; data?: Quote; error?: string }>(response);
    setSending(false);
    if (response.ok && result?.data) {
      setCurrentQuote(result.data);
      setSent(true);
      setMessage("Preventivo inviato al cliente.");
      router.refresh();
    } else {
      setMessage(adminApiErrorMessage(response, result, "Impossibile inviare il preventivo. Riprova."));
    }
  }

  const activeHotels = hotels.filter((h) => h.active);
  const roomCapacitySuggestion = suggestedGuestsPerRoom(adultsCount + currentQuote.children.length, roomsCount);
  const isQuoteSent = sent || currentQuote.status === "preventivo_inviato";

  // Struttura selezionata dal cliente (se confermata con opzione)
  const effectiveOptions = getEffectiveHotelOptions(currentQuote);
  const selectedOption = currentQuote.confirmation?.selectedHotelOptionId
    ? effectiveOptions.find((o) => o.id === currentQuote.confirmation?.selectedHotelOptionId)
    : effectiveOptions.find((o) => o.isSelected);
  const confirmedSelection = [
    currentQuote.confirmation?.selectedHotelName ?? selectedOption?.hotelName,
    selectedOption?.roomTypeLabel,
    currentQuote.confirmation?.selectedTreatmentLabel,
    currentQuote.confirmation?.selectedPrice != null ? formatCurrency(currentQuote.confirmation.selectedPrice) : undefined
  ].filter(Boolean).join(" - ");

  return (
    <div className="space-y-6">
      {currentQuote.confirmation ? <ConfirmationAvailabilityPanel quote={currentQuote} paymentSettings={paymentSettings} /> : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_0.36fr]">
      <form className="space-y-5" onSubmit={save}>
        {message ? <p className="rounded-2xl bg-ischia-mist p-4 text-sm font-bold text-ischia-navy">{message}</p> : null}

        <Section title="Cliente e soggiorno">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input name="firstName" label="Nome" defaultValue={currentQuote.customerFirstName} required />
            <Input name="lastName" label="Cognome" defaultValue={currentQuote.customerLastName} />
            <Input name="phone" label="Telefono WhatsApp" defaultValue={currentQuote.customerPhone} required />
            <Input name="email" label="Email" defaultValue={currentQuote.customerEmail} type="email" />
            <Input name="checkIn" label="Data arrivo" defaultValue={currentQuote.arrivalDate} required type="date" />
            <Input name="checkOut" label="Data partenza" defaultValue={currentQuote.departureDate} required type="date" />
            <Input name="adults" label="Adulti" min="1" value={String(adultsCount)} onChange={(e) => setAdultsCount(Number(e.target.value) || 1)} required type="number" />
            <Input name="rooms" label="Camere" min="1" value={String(roomsCount)} onChange={(e) => setRoomsCount(Number(e.target.value) || 1)} required type="number" />
            <Input name="hotelRequested" label="Hotel richiesto dal cliente" defaultValue={currentQuote.requestedHotel} />
          </div>
        </Section>

        <Section title="Proposte hotel">
          {confirmedSelection && (
            <div className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200">
              Scelta confermata: <strong>{confirmedSelection}</strong>
            </div>
          )}
          <p className="text-sm text-ischia-ink/65">Inserisci fino a 3 strutture. Lascia vuoto il prezzo di un trattamento per non mostrarlo.</p>
          <HotelOptionsEditor
            activeHotels={activeHotels}
            hotelOptions={hotelOptions}
            onChange={setHotelOptions}
            preserveGroups
            showStars={false}
            suggestedCapacity={roomCapacitySuggestion}
          />
        </Section>

        <Section title="Condizioni preventivo">
          <div className="grid gap-3 sm:grid-cols-3">
            <Input name="totalPrice" label="Prezzo totale (legacy)" defaultValue={String(currentQuote.totalPrice)} type="number" />
            <Input name="depositAmount" label="Acconto" defaultValue={String(currentQuote.deposit)} required type="number" />
            <Input name="validUntil" label="Scadenza offerta" defaultValue={currentQuote.offerExpiresAt} required type="date" />
          </div>
          <Textarea name="publicNotes" label="Note visibili al cliente" defaultValue={currentQuote.customerNotes} />
          <Textarea name="internalNotes" label="Note interne" defaultValue={currentQuote.internalNotes} />
        </Section>

        <button className="rounded-full bg-ischia-sun px-5 py-3 font-black text-ischia-navy disabled:opacity-60" disabled={loading} type="submit">
          {loading ? "Salvataggio..." : "Salva modifiche"}
        </button>
      </form>

      <aside className="space-y-4">
        {currentQuote.confirmation ? (
          <div className="rounded-2xl bg-emerald-50/80 p-5 shadow-soft ring-1 ring-emerald-200">
            <h3 className="font-black text-ischia-navy">Conferma cliente ricevuta</h3>
            <p className="mt-2 text-sm font-semibold text-emerald-800">
              Ora va verificata la disponibilità con la struttura.
            </p>
            <a className="mt-4 block rounded-full bg-ischia-leaf px-4 py-2 text-center text-sm font-black text-white" href="#verifica-disponibilita">
              Gestisci disponibilità
            </a>
          </div>
        ) : null}

        {/* Card principale: codice + stato + azioni chiave */}
        <div className="rounded-2xl bg-white/90 p-5 text-center shadow-soft">
          <div className="flex flex-col items-center justify-center gap-2 sm:flex-row sm:justify-between">
            <h2 className="text-xl font-black text-ischia-navy">{currentQuote.code}</h2>
            <QuoteStatusBadge status={currentQuote.status} />
          </div>

          {/* Riepilogo hotel options (dopo il fix undefined) */}
          {getEffectiveHotelOptions(currentQuote).filter((o) => o.hotelName).length > 0 && (
            <div className="mt-3 space-y-1 text-sm text-ischia-ink/70">
              {getEffectiveHotelOptions(currentQuote).filter((o) => o.hotelName).map((opt) => (
                <p key={opt.id} className={opt.isSelected ? "font-bold text-emerald-700" : ""}>
                  {opt.isSelected ? "? " : ""}{opt.hotelName}
                  {opt.treatments.length > 0 && ` - ${opt.treatments.map((t) => formatCurrency(t.price)).join(" / ")}`}
                </p>
              ))}
            </div>
          )}

          {/* Stato "inviato": mostra solo WhatsApp */}
          {isQuoteSent ? (
            <div className="mt-5 grid gap-3 [&_a]:block [&_a]:text-center">
              <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200">
                Preventivo già inviato. Puoi reinviare il link al cliente su WhatsApp.
              </div>
              <WhatsAppSendButton quote={currentQuote} label="Invia link su WhatsApp" />
              <Link className="block rounded-full bg-ischia-navy px-4 py-2 text-center text-sm font-black text-white" href={publicQuoteUrl(currentQuote)} rel="noopener noreferrer" target="_blank">
                Apri link cliente
              </Link>
            </div>
          ) : currentQuote.confirmation ? (
            <div className="mt-5 grid gap-2 [&_a]:block [&_a]:text-center">
              <Link className="rounded-full bg-ischia-navy px-4 py-2 text-center text-sm font-black text-white" href={publicQuoteUrl(currentQuote)} rel="noopener noreferrer" target="_blank">
                Apri link cliente
              </Link>
              <WhatsAppSendButton quote={currentQuote} />
              <button className="rounded-full bg-ischia-sun px-4 py-2 text-sm font-black text-ischia-navy" onClick={() => void duplicateCurrentQuote()} type="button">
                Duplica preventivo
              </button>
            </div>
          ) : (
            <div className="mt-5 grid gap-2 [&_a]:block [&_a]:text-center">
              <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 ring-1 ring-amber-200">
                Controlla l&apos;anteprima cliente prima di segnare il preventivo come inviato.
              </p>
              <Link
                className="rounded-full bg-ischia-navy/10 px-4 py-2 text-center text-sm font-bold text-ischia-navy ring-1 ring-ischia-navy/20"
                href={publicQuoteUrl(currentQuote)}
                onClick={() => setPreviewOpened(true)}
                rel="noopener noreferrer"
                target="_blank"
              >
                Apri anteprima cliente
              </Link>
              <button
                className="rounded-full bg-ischia-leaf px-4 py-2 text-center text-sm font-black text-white disabled:opacity-60"
                disabled={sending || !previewOpened}
                onClick={() => void sendQuote()}
                type="button"
              >
                {sending ? "Aggiornamento..." : previewOpened ? "Invia preventivo" : "Apri prima l'anteprima"}
              </button>
              {previewOpened ? <WhatsAppSendButton quote={currentQuote} /> : null}
              <button className="rounded-full bg-ischia-sun px-4 py-2 text-sm font-black text-ischia-navy" onClick={() => void duplicateCurrentQuote()} type="button">
                Duplica preventivo
              </button>
            </div>
          )}
        </div>

        {/* Cambia stato manuale */}
        {!isQuoteSent && (
          <div className="rounded-2xl bg-white/90 p-5 text-center shadow-soft">
            <h3 className="font-black text-ischia-navy">Cambia stato</h3>
            <div className="mt-3 grid gap-2">
              {statusOptions.map((status) => (
                <button key={status} className="rounded-full bg-white px-4 py-2 text-sm font-black text-ischia-navy ring-1 ring-ischia-blue/20" onClick={() => void changeStatus(status)} type="button">
                  {statusLabel(status)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Azioni preventivo */}
        <div className="rounded-2xl bg-white/90 p-5 text-center shadow-soft">
          <h3 className="font-black text-ischia-navy">Azioni preventivo</h3>
          {currentQuote.excludedFromStats && !currentQuote.deletedAt ? (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">Escluso dalle statistiche</p>
          ) : null}
          {currentQuote.deletedAt ? (
            <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">Preventivo cancellato</p>
          ) : null}
          <div className="mt-3 grid gap-2">
            {!currentQuote.deletedAt ? (
              <button className="rounded-full bg-white px-4 py-2 text-sm font-black text-amber-700 ring-1 ring-amber-200" onClick={() => void toggleExcludeFromStats()} type="button">
                {currentQuote.excludedFromStats ? "Reincludi nelle statistiche" : "Escludi dalle statistiche"}
              </button>
            ) : null}
            <CloneQuoteButton quoteId={currentQuote.id} />
            {currentQuote.deletedAt ? (
              <button className="rounded-full bg-ischia-leaf px-4 py-2 text-sm font-black text-white" onClick={() => void restoreCurrentQuote()} type="button">
                Ripristina preventivo
              </button>
            ) : (
              <button className="rounded-full bg-rose-50 px-4 py-2 text-sm font-black text-rose-700 ring-1 ring-rose-100" onClick={() => void deleteCurrentQuote()} type="button">
                Cancella preventivo
              </button>
            )}
          </div>
        </div>
      </aside>
    </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl bg-white/90 p-5 shadow-soft"><h2 className="text-xl font-black text-ischia-navy">{title}</h2><div className="mt-4 space-y-3">{children}</div></section>;
}

function Input({ label, ...props }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return <label className="text-sm font-semibold text-ischia-ink">{label}<input className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2" {...props} /></label>;
}

function Textarea({ label, value, onChange, ...props }: { label: string; value?: string; onChange?: (value: string) => void } & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value">) {
  return <label className="block text-sm font-semibold text-ischia-ink">{label}<textarea className="mt-1 min-h-20 w-full rounded-xl border border-ischia-blue/20 px-3 py-2" value={value} onChange={onChange ? (e) => onChange(e.target.value) : undefined} {...props} /></label>;
}

function withDefaultTransportOffers(offers: TransportOffer[] = []): TransportOffer[] {
  return offers;
}

function statusLabel(status: QuoteStatus) {
  if (status === "preventivo_inviato") return "Preventivo inviato";
  if (status === "confermato") return "Confermato";
  if (status === "perso_non_disponibile") return "Perso / non disponibile";
  if (status === "in_lavorazione") return "In lavorazione";
  return "Da evadere";
}


