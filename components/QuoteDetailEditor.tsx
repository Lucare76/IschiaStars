"use client";

import Link from "next/link";
import type { FormEvent, InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { useState } from "react";
import { ConfirmationAvailabilityPanel } from "@/components/ConfirmationAvailabilityPanel";
import { QuoteStatusBadge } from "@/components/QuoteStatusBadge";
import { WhatsAppSendButton } from "@/components/WhatsAppSendButton";
import { adminApiFetch } from "@/lib/admin-api-client";
import { fillMissingHotelPolicies } from "@/lib/hotel-policies";
import { getEffectiveHotelOptions } from "@/lib/repositories/shared";
import { Hotel, Quote, QuoteHotelOption, QuoteStatus, TransportOffer } from "@/lib/types";
import { formatCurrency, publicQuoteUrl } from "@/lib/utils";

const statusOptions: QuoteStatus[] = ["preventivo_inviato", "confermato", "perso_non_disponibile"];

type RoomTypeState = {
  label: string;
  breakfastPrice: string;
  halfBoardPrice: string;
  fullBoardPrice: string;
};

type HotelOptionState = {
  hotelGroup: number;
  hotelId: string;
  hotelName: string;
  hotelLocation: string;
  hotelStars: string;
  hotelImageUrl: string;
  sourceUrl: string;
  includedServices: string;
  depositPercent: string;
  balanceMethod: string;
  paymentPolicy: string;
  cancellationPolicy: string;
  paymentNotes: string;
  notes: string;
  roomTypes: RoomTypeState[];
};

function emptyRoomType(): RoomTypeState {
  return { label: "", breakfastPrice: "", halfBoardPrice: "", fullBoardPrice: "" };
}

function quoteOptionToRoomType(opt: QuoteHotelOption): RoomTypeState {
  return {
    label: opt.roomTypeLabel ?? "",
    breakfastPrice: opt.breakfastPrice != null ? String(opt.breakfastPrice) : "",
    halfBoardPrice: opt.halfBoardPrice != null ? String(opt.halfBoardPrice) : "",
    fullBoardPrice: opt.fullBoardPrice != null ? String(opt.fullBoardPrice) : ""
  };
}

// Raggruppa hotel options flat in HotelOptionState[] (una riga per hotel_group)
function groupOptionsToState(opts: QuoteHotelOption[]): HotelOptionState[] {
  const groups = new Map<number, QuoteHotelOption[]>();
  for (const opt of opts) {
    const g = opt.hotelGroup ?? 1;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(opt);
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => a - b)
    .map(([groupId, groupOpts]) => {
      const first = groupOpts[0];
      return {
        hotelGroup: groupId,
        hotelId: first.hotelId ?? "",
        hotelName: first.hotelName,
        hotelLocation: first.hotelLocation ?? "",
        hotelStars: first.hotelStars != null ? String(first.hotelStars) : "",
        hotelImageUrl: first.hotelImageUrl ?? "",
        sourceUrl: first.sourceUrl ?? "",
        includedServices: first.includedServices ?? "",
        depositPercent: first.depositPercent != null ? String(first.depositPercent) : "",
        balanceMethod: first.balanceMethod ?? "",
        paymentPolicy: first.paymentPolicy ?? "",
        cancellationPolicy: first.cancellationPolicy ?? "",
        paymentNotes: first.paymentNotes ?? "",
        notes: first.notes ?? "",
        roomTypes: groupOpts.map(quoteOptionToRoomType)
      };
    });
}

function emptyOption(hotel?: Hotel, groupId = 1): HotelOptionState {
  const policies = hotelPolicies(hotel);
  return {
    hotelGroup: groupId,
    hotelId: hotel?.id ?? "",
    hotelName: hotel?.name ?? "",
    hotelLocation: hotel?.zone ?? "",
    hotelStars: hotel ? String(hotel.stars) : "",
    hotelImageUrl: hotel?.imageUrl ?? hotel?.externalImageUrl ?? "",
    sourceUrl: hotel?.sourceUrl ?? "",
    includedServices: hotel?.standardServices.join("\n") ?? "",
    depositPercent: policies.depositPercent != null ? String(policies.depositPercent) : "",
    balanceMethod: policies.balanceMethod,
    paymentPolicy: policies.paymentPolicy,
    cancellationPolicy: policies.cancellationPolicy,
    paymentNotes: policies.paymentNotes,
    notes: "",
    roomTypes: [emptyRoomType()]
  };
}

export function QuoteDetailEditor({ quote, hotels }: { quote: Quote; hotels: Hotel[] }) {
  const effective = getEffectiveHotelOptions(quote);
  const [currentQuote, setCurrentQuote] = useState(quote);
  const [hotelOptions, setHotelOptions] = useState<HotelOptionState[]>(groupOptionsToState(effective));
  const [transportOffers] = useState<TransportOffer[]>(withDefaultTransportOffers(quote.transportOffers));
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  function updateOption(index: number, patch: Partial<HotelOptionState>) {
    setHotelOptions((prev) => prev.map((opt, i) => (i === index ? { ...opt, ...patch } : opt)));
  }

  function selectHotel(index: number, hotelId: string) {
    const hotel = hotels.find((h) => h.id === hotelId);
    const policies = hotelPolicies(hotel);
    updateOption(index, {
      hotelId,
      hotelName: hotel?.name ?? "",
      hotelLocation: hotel?.zone ?? "",
      hotelStars: hotel ? String(hotel.stars) : "",
      hotelImageUrl: hotel?.imageUrl ?? hotel?.externalImageUrl ?? "",
      sourceUrl: hotel?.sourceUrl ?? "",
      includedServices: hotel?.standardServices.join("\n") ?? "",
      depositPercent: policies.depositPercent != null ? String(policies.depositPercent) : "",
      balanceMethod: policies.balanceMethod,
      paymentPolicy: policies.paymentPolicy,
      cancellationPolicy: policies.cancellationPolicy,
      paymentNotes: policies.paymentNotes
    });
  }

  function addOption() {
    if (hotelOptions.length >= 3) return;
    const usedIds = new Set(hotelOptions.map((o) => o.hotelId));
    const nextHotel = hotels.find((h) => h.active && !usedIds.has(h.id));
    const nextGroup = Math.max(0, ...hotelOptions.map((o) => o.hotelGroup)) + 1;
    setHotelOptions((prev) => [...prev, emptyOption(nextHotel, nextGroup)]);
  }

  function removeOption(index: number) {
    if (hotelOptions.length <= 1) return;
    setHotelOptions((prev) => prev.filter((_, i) => i !== index));
  }

  function updateRoomType(optIndex: number, roomIndex: number, patch: Partial<RoomTypeState>) {
    setHotelOptions((prev) => prev.map((opt, i) => {
      if (i !== optIndex) return opt;
      return { ...opt, roomTypes: opt.roomTypes.map((rt, j) => j === roomIndex ? { ...rt, ...patch } : rt) };
    }));
  }

  function addRoomType(optIndex: number) {
    setHotelOptions((prev) => prev.map((opt, i) => {
      if (i !== optIndex || opt.roomTypes.length >= 3) return opt;
      return { ...opt, roomTypes: [...opt.roomTypes, emptyRoomType()] };
    }));
  }

  function removeRoomType(optIndex: number, roomIndex: number) {
    setHotelOptions((prev) => prev.map((opt, i) => {
      if (i !== optIndex || opt.roomTypes.length <= 1) return opt;
      return { ...opt, roomTypes: opt.roomTypes.filter((_, j) => j !== roomIndex) };
    }));
  }

  function optionHasPrice(opt: HotelOptionState) {
    return opt.roomTypes.some((rt) => rt.breakfastPrice || rt.halfBoardPrice || rt.fullBoardPrice);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    const formData = new FormData(event.currentTarget);

    const mappedOptions: object[] = [];
    let globalPosition = 0;
    hotelOptions.filter(optionHasPrice).forEach((opt) => {
      opt.roomTypes
        .filter((rt) => rt.breakfastPrice || rt.halfBoardPrice || rt.fullBoardPrice)
        .forEach((rt) => {
          globalPosition++;
          mappedOptions.push({
            hotelId: opt.hotelId || undefined,
            hotelGroup: opt.hotelGroup,
            position: globalPosition,
            roomTypeLabel: rt.label || undefined,
            hotelName: opt.hotelName,
            hotelLocation: opt.hotelLocation || undefined,
            hotelStars: opt.hotelStars ? Number(opt.hotelStars) : undefined,
            hotelImageUrl: opt.hotelImageUrl || undefined,
            sourceUrl: opt.sourceUrl || undefined,
            breakfastPrice: rt.breakfastPrice ? Number(rt.breakfastPrice) : undefined,
            halfBoardPrice: rt.halfBoardPrice ? Number(rt.halfBoardPrice) : undefined,
            fullBoardPrice: rt.fullBoardPrice ? Number(rt.fullBoardPrice) : undefined,
            includedServices: opt.includedServices || undefined,
            depositPercent: opt.depositPercent ? Number(opt.depositPercent) : undefined,
            balanceMethod: opt.balanceMethod || undefined,
            paymentPolicy: opt.paymentPolicy || undefined,
            cancellationPolicy: opt.cancellationPolicy || undefined,
            paymentNotes: opt.paymentNotes || undefined,
            notes: opt.notes || undefined
          });
        });
    });

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
    const result = (await response.json().catch(() => null)) as { ok?: boolean; data?: Quote; source?: string; error?: string } | null;
    setLoading(false);
    if (!response.ok || !result?.ok || !result.data) {
      setMessage(response.status === 401 ? "Sessione scaduta, effettua di nuovo il login." : result?.error ?? "Salvataggio non riuscito");
      return;
    }
    setCurrentQuote(result.data);
    setMessage("Preventivo aggiornato.");
  }

  async function changeStatus(status: QuoteStatus) {
    const response = await adminApiFetch(`/api/quotes/${currentQuote.id}`, {
      method: "PATCH",
      body: JSON.stringify({ statusOnly: true, status })
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; data?: Quote } | null;
    if (response.ok && result?.data) setCurrentQuote(result.data);
  }

  async function toggleExcludeFromStats() {
    setMessage(null);
    const next = !currentQuote.excludedFromStats;
    const response = await adminApiFetch(`/api/quotes/${currentQuote.id}`, {
      method: "PATCH",
      body: JSON.stringify({ excludedFromStats: next })
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; data?: Quote } | null;
    if (response.ok && result?.data) {
      setCurrentQuote(result.data);
      setMessage(next ? "Preventivo escluso dalle statistiche." : "Preventivo reinclueso nelle statistiche.");
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
    const result = (await response.json().catch(() => null)) as { ok?: boolean; data?: Quote } | null;
    if (response.ok && result?.data) {
      setCurrentQuote(result.data);
      setMessage("Preventivo cancellato.");
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
    const result = (await response.json().catch(() => null)) as { ok?: boolean; data?: Quote } | null;
    if (response.ok && result?.data) {
      setCurrentQuote(result.data);
      setMessage("Preventivo ripristinato.");
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
    const result = (await response.json().catch(() => null)) as { ok?: boolean; data?: Quote; error?: string } | null;
    if (!response.ok || !result?.ok || !result.data) {
      setMessage(response.status === 401 ? "Sessione scaduta, effettua di nuovo il login." : result?.error ?? "Duplicazione non riuscita");
      return;
    }
    window.location.href = `/admin/preventivi/${result.data.code}`;
  }

  async function sendQuote() {
    setSending(true);
    setMessage(null);
    const response = await adminApiFetch(`/api/quotes/${currentQuote.id}`, {
      method: "PATCH",
      body: JSON.stringify({ statusOnly: true, status: "preventivo_inviato" })
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; data?: Quote } | null;
    setSending(false);
    if (response.ok && result?.data) {
      setCurrentQuote(result.data);
      setSent(true);
    } else {
      setMessage(response.status === 401 ? "Sessione scaduta, effettua di nuovo il login." : "Impossibile aggiornare lo stato. Riprova.");
    }
  }

  const activeHotels = hotels.filter((h) => h.active);

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
      {currentQuote.confirmation ? <ConfirmationAvailabilityPanel quote={currentQuote} /> : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_0.36fr]">
      <form className="space-y-5" onSubmit={save}>
        {message ? <p className="rounded-2xl bg-ischia-mist p-4 text-sm font-bold text-ischia-navy">{message}</p> : null}

        <Section title="Cliente e soggiorno">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input name="firstName" label="Nome" defaultValue={currentQuote.customerFirstName} required />
            <Input name="lastName" label="Cognome" defaultValue={currentQuote.customerLastName} required />
            <Input name="phone" label="Telefono WhatsApp" defaultValue={currentQuote.customerPhone} required />
            <Input name="email" label="Email" defaultValue={currentQuote.customerEmail} required type="email" />
            <Input name="checkIn" label="Data arrivo" defaultValue={currentQuote.arrivalDate} required type="date" />
            <Input name="checkOut" label="Data partenza" defaultValue={currentQuote.departureDate} required type="date" />
            <Input name="adults" label="Adulti" defaultValue={String(currentQuote.adults)} required type="number" />
            <Input name="rooms" label="Camere" defaultValue={String(currentQuote.rooms)} required type="number" />
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
          <div className="space-y-4">
            {hotelOptions.map((opt, index) => (
              <HotelOptionBlock
                key={index}
                index={index}
                opt={opt}
                activeHotels={activeHotels}
                total={hotelOptions.length}
                onSelectHotel={(id) => selectHotel(index, id)}
                onChange={(patch) => updateOption(index, patch)}
                onRemove={() => removeOption(index)}
                onUpdateRoomType={(roomIdx, patch) => updateRoomType(index, roomIdx, patch)}
                onAddRoomType={() => addRoomType(index)}
                onRemoveRoomType={(roomIdx) => removeRoomType(index, roomIdx)}
              />
            ))}
          </div>
          {hotelOptions.length < 3 && (
            <button
              className="mt-2 rounded-full bg-ischia-mist px-4 py-2 text-sm font-black text-ischia-navy ring-1 ring-ischia-blue/15"
              onClick={addOption}
              type="button"
            >
              + Aggiungi struttura ({hotelOptions.length}/3)
            </button>
          )}
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
        <div className="rounded-2xl bg-white/90 p-5 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-black text-ischia-navy">{currentQuote.code}</h2>
            <QuoteStatusBadge status={currentQuote.status} />
          </div>

          {/* Riepilogo hotel options (dopo il fix undefined) */}
          {getEffectiveHotelOptions(currentQuote).filter((o) => o.hotelName).length > 0 && (
            <div className="mt-3 space-y-1 text-sm text-ischia-ink/70">
              {getEffectiveHotelOptions(currentQuote).filter((o) => o.hotelName).map((opt) => (
                <p key={opt.id} className={opt.isSelected ? "font-bold text-emerald-700" : ""}>
                  {opt.isSelected ? "✓ " : ""}{opt.hotelName}
                  {opt.treatments.length > 0 && ` — ${opt.treatments.map((t) => formatCurrency(t.price)).join(" / ")}`}
                </p>
              ))}
            </div>
          )}

          {/* Stato "inviato": mostra solo WhatsApp */}
          {sent ? (
            <div className="mt-5 space-y-3">
              <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200">
                Preventivo segnato come inviato. Invia il link al cliente su WhatsApp.
              </div>
              <WhatsAppSendButton quote={currentQuote} label="Invia link su WhatsApp" />
              <Link className="block rounded-full bg-ischia-navy px-4 py-2 text-center text-sm font-black text-white" href={publicQuoteUrl(currentQuote)} rel="noopener noreferrer" target="_blank">
                Apri link cliente
              </Link>
            </div>
          ) : currentQuote.confirmation ? (
            <div className="mt-5 grid gap-2">
              <Link className="rounded-full bg-ischia-navy px-4 py-2 text-center text-sm font-black text-white" href={publicQuoteUrl(currentQuote)} rel="noopener noreferrer" target="_blank">
                Apri link cliente
              </Link>
              <WhatsAppSendButton quote={currentQuote} />
              <button className="rounded-full bg-ischia-sun px-4 py-2 text-sm font-black text-ischia-navy" onClick={() => void duplicateCurrentQuote()} type="button">
                Duplica preventivo
              </button>
            </div>
          ) : (
            <div className="mt-5 grid gap-2">
              {/* Pulsante principale: Invia preventivo */}
              <button
                className="rounded-full bg-ischia-leaf px-4 py-2 text-center text-sm font-black text-white disabled:opacity-60"
                disabled={sending}
                onClick={() => void sendQuote()}
                type="button"
              >
                {sending ? "Aggiornamento..." : "Invia preventivo"}
              </button>
              <Link className="rounded-full bg-ischia-navy px-4 py-2 text-center text-sm font-black text-white" href={publicQuoteUrl(currentQuote)} rel="noopener noreferrer" target="_blank">
                Apri link cliente
              </Link>
              <WhatsAppSendButton quote={currentQuote} />
              <button className="rounded-full bg-ischia-sun px-4 py-2 text-sm font-black text-ischia-navy" onClick={() => void duplicateCurrentQuote()} type="button">
                Duplica preventivo
              </button>
            </div>
          )}
        </div>

        {/* Cambia stato manuale */}
        {!sent && (
          <div className="rounded-2xl bg-white/90 p-5 shadow-soft">
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
        <div className="rounded-2xl bg-white/90 p-5 shadow-soft">
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

function HotelOptionBlock({
  index, opt, activeHotels, total, onSelectHotel, onChange, onRemove,
  onUpdateRoomType, onAddRoomType, onRemoveRoomType
}: {
  index: number; opt: HotelOptionState; activeHotels: Hotel[]; total: number;
  onSelectHotel: (id: string) => void; onChange: (patch: Partial<HotelOptionState>) => void; onRemove: () => void;
  onUpdateRoomType: (roomIndex: number, patch: Partial<RoomTypeState>) => void;
  onAddRoomType: () => void; onRemoveRoomType: (roomIndex: number) => void;
}) {
  const hasPrice = opt.roomTypes.some((rt) => rt.breakfastPrice || rt.halfBoardPrice || rt.fullBoardPrice);
  return (
    <div className="rounded-2xl border border-ischia-blue/15 bg-ischia-mist/50 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-black text-ischia-navy">Struttura {index + 1}</h3>
        {total > 1 && <button className="text-sm font-semibold text-rose-600" onClick={onRemove} type="button">Rimuovi struttura</button>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {activeHotels.length > 0 && (
          <label className="col-span-2 text-sm font-semibold text-ischia-ink sm:col-span-1">
            Seleziona da DB
            <select className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2" value={opt.hotelId} onChange={(e) => onSelectHotel(e.target.value)}>
              <option value="">— Digita nome manualmente —</option>
              {activeHotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </label>
        )}
        <label className="text-sm font-semibold text-ischia-ink">
          Nome struttura *
          <input className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2" required value={opt.hotelName} onChange={(e) => onChange({ hotelName: e.target.value })} />
        </label>
        <label className="text-sm font-semibold text-ischia-ink">
          Zona
          <input className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2" value={opt.hotelLocation} onChange={(e) => onChange({ hotelLocation: e.target.value })} />
        </label>
      </div>

      {(opt.hotelImageUrl || opt.sourceUrl) && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-ischia-blue/10">
          {opt.hotelImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={opt.hotelName || "Anteprima hotel"} className="h-16 w-24 rounded-lg object-cover" src={opt.hotelImageUrl} />
          ) : null}
          <div className="text-sm font-semibold text-ischia-ink/70">
            {opt.hotelImageUrl ? <p>Immagine hotel disponibile</p> : null}
            {opt.sourceUrl ? <p>Scheda hotel disponibile</p> : null}
          </div>
        </div>
      )}

      {/* Tipologie camera */}
      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wide text-ischia-blue/70">Tipologie camera e prezzi</p>
          {opt.roomTypes.length < 3 && (
            <button className="rounded-full bg-ischia-mist px-3 py-1 text-xs font-black text-ischia-navy ring-1 ring-ischia-blue/15" onClick={onAddRoomType} type="button">
              + Camera ({opt.roomTypes.length}/3)
            </button>
          )}
        </div>
        {opt.roomTypes.map((rt, roomIdx) => (
          <div key={roomIdx} className="rounded-xl border border-ischia-blue/10 bg-white p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <label className="flex-1 text-sm font-semibold text-ischia-ink">
                {opt.roomTypes.length > 1 ? `Tipologia ${roomIdx + 1}` : "Tipologia camera (opzionale)"}
                <input className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2" placeholder="es. Camera Doppia, Camera Superior, Suite..." value={rt.label} onChange={(e) => onUpdateRoomType(roomIdx, { label: e.target.value })} />
              </label>
              {opt.roomTypes.length > 1 && (
                <button className="mt-5 text-xs font-semibold text-rose-500" onClick={() => onRemoveRoomType(roomIdx)} type="button">Rimuovi</button>
              )}
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="text-xs font-semibold text-ischia-ink">Cam. e col. (€)<input className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-2 py-1.5 text-sm" min="0" placeholder="vuoto = no" type="number" value={rt.breakfastPrice} onChange={(e) => onUpdateRoomType(roomIdx, { breakfastPrice: e.target.value })} /></label>
              <label className="text-xs font-semibold text-ischia-ink">Mezza pens. (€)<input className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-2 py-1.5 text-sm" min="0" placeholder="vuoto = no" type="number" value={rt.halfBoardPrice} onChange={(e) => onUpdateRoomType(roomIdx, { halfBoardPrice: e.target.value })} /></label>
              <label className="text-xs font-semibold text-ischia-ink">Pens. compl. (€)<input className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-2 py-1.5 text-sm" min="0" placeholder="vuoto = no" type="number" value={rt.fullBoardPrice} onChange={(e) => onUpdateRoomType(roomIdx, { fullBoardPrice: e.target.value })} /></label>
            </div>
          </div>
        ))}
      </div>

      {!hasPrice && (
        <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
          Inserisci almeno un prezzo per mostrare questa struttura nel preventivo.
        </p>
      )}
      <div className="mt-3 space-y-2">
        <Textarea label="Servizi inclusi" value={opt.includedServices} onChange={(v) => onChange({ includedServices: v })} />
        <div className="grid gap-2 sm:grid-cols-2">
          <Input label="Acconto (%)" min="0" step="0.01" type="number" value={opt.depositPercent} onChange={(e) => onChange({ depositPercent: e.target.value })} />
          <Input label="Modalita saldo" value={opt.balanceMethod} onChange={(e) => onChange({ balanceMethod: e.target.value })} />
        </div>
        <Textarea label="Policy pagamento" value={opt.paymentPolicy} onChange={(v) => onChange({ paymentPolicy: v })} />
        <Textarea label="Policy cancellazione" value={opt.cancellationPolicy} onChange={(v) => onChange({ cancellationPolicy: v })} />
        <Textarea label="Note pagamento" value={opt.paymentNotes} onChange={(v) => onChange({ paymentNotes: v })} />
        <Textarea label="Note per il cliente" value={opt.notes} onChange={(v) => onChange({ notes: v })} />
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

function hotelPolicies(hotel?: Hotel) {
  return fillMissingHotelPolicies({
    hotelName: hotel?.name ?? "",
    depositPercent: hotel?.defaultDepositPercent,
    balanceMethod: hotel?.defaultBalanceMethod,
    paymentPolicy: hotel?.paymentPolicy,
    cancellationPolicy: hotel?.cancellationPolicy,
    paymentNotes: hotel?.defaultPaymentNotes
  });
}
