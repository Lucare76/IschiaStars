"use client";

import Link from "next/link";
import type { FormEvent, InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { useState } from "react";
import { QuoteStatusBadge } from "@/components/QuoteStatusBadge";
import { WhatsAppSendButton } from "@/components/WhatsAppSendButton";
import { adminApiHeaders } from "@/lib/admin-api-client";
import { getEffectiveHotelOptions } from "@/lib/repositories/shared";
import { Hotel, Quote, QuoteHotelOption, QuoteStatus, TransportOffer } from "@/lib/types";
import { formatCurrency, publicQuoteUrl } from "@/lib/utils";

const statusOptions: QuoteStatus[] = ["preventivo_inviato", "confermato", "perso_non_disponibile"];

type HotelOptionState = {
  id?: string;
  hotelId: string;
  hotelName: string;
  hotelLocation: string;
  hotelStars: string;
  breakfastPrice: string;
  halfBoardPrice: string;
  fullBoardPrice: string;
  includedServices: string;
  paymentPolicy: string;
  cancellationPolicy: string;
  notes: string;
};

function quoteOptionToState(opt: QuoteHotelOption): HotelOptionState {
  return {
    id: opt.id.startsWith("virtual-") ? undefined : opt.id,
    hotelId: opt.hotelId ?? "",
    hotelName: opt.hotelName,
    hotelLocation: opt.hotelLocation ?? "",
    hotelStars: opt.hotelStars != null ? String(opt.hotelStars) : "",
    breakfastPrice: opt.breakfastPrice != null ? String(opt.breakfastPrice) : "",
    halfBoardPrice: opt.halfBoardPrice != null ? String(opt.halfBoardPrice) : "",
    fullBoardPrice: opt.fullBoardPrice != null ? String(opt.fullBoardPrice) : "",
    includedServices: opt.includedServices ?? "",
    paymentPolicy: opt.paymentPolicy ?? "",
    cancellationPolicy: opt.cancellationPolicy ?? "",
    notes: opt.notes ?? ""
  };
}

function emptyOption(hotel?: Hotel): HotelOptionState {
  return {
    hotelId: hotel?.id ?? "",
    hotelName: hotel?.name ?? "",
    hotelLocation: hotel?.zone ?? "",
    hotelStars: hotel ? String(hotel.stars) : "",
    breakfastPrice: "",
    halfBoardPrice: "",
    fullBoardPrice: "",
    includedServices: hotel?.standardServices.join("\n") ?? "",
    paymentPolicy: hotel?.paymentPolicy ?? "",
    cancellationPolicy: hotel?.cancellationPolicy ?? "",
    notes: ""
  };
}

export function QuoteDetailEditor({ quote, hotels }: { quote: Quote; hotels: Hotel[] }) {
  const effective = getEffectiveHotelOptions(quote);
  const [currentQuote, setCurrentQuote] = useState(quote);
  const [hotelOptions, setHotelOptions] = useState<HotelOptionState[]>(effective.map(quoteOptionToState));
  const [transportOffers] = useState<TransportOffer[]>(withDefaultTransportOffers(quote.transportOffers));
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function updateOption(index: number, patch: Partial<HotelOptionState>) {
    setHotelOptions((prev) => prev.map((opt, i) => (i === index ? { ...opt, ...patch } : opt)));
  }

  function selectHotel(index: number, hotelId: string) {
    const hotel = hotels.find((h) => h.id === hotelId);
    updateOption(index, {
      hotelId,
      hotelName: hotel?.name ?? "",
      hotelLocation: hotel?.zone ?? "",
      hotelStars: hotel ? String(hotel.stars) : "",
      includedServices: hotel?.standardServices.join("\n") ?? "",
      paymentPolicy: hotel?.paymentPolicy ?? "",
      cancellationPolicy: hotel?.cancellationPolicy ?? ""
    });
  }

  function addOption() {
    if (hotelOptions.length >= 3) return;
    const usedIds = new Set(hotelOptions.map((o) => o.hotelId));
    const nextHotel = hotels.find((h) => h.active && !usedIds.has(h.id));
    setHotelOptions((prev) => [...prev, emptyOption(nextHotel)]);
  }

  function removeOption(index: number) {
    if (hotelOptions.length <= 1) return;
    setHotelOptions((prev) => prev.filter((_, i) => i !== index));
  }

  function optionHasPrice(opt: HotelOptionState) {
    return Boolean(opt.breakfastPrice || opt.halfBoardPrice || opt.fullBoardPrice);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    const formData = new FormData(event.currentTarget);

    const mappedOptions = hotelOptions
      .filter(optionHasPrice)
      .map((opt, index) => ({
        hotelId: opt.hotelId || undefined,
        position: index + 1,
        hotelName: opt.hotelName,
        hotelLocation: opt.hotelLocation || undefined,
        hotelStars: opt.hotelStars ? Number(opt.hotelStars) : undefined,
        breakfastPrice: opt.breakfastPrice ? Number(opt.breakfastPrice) : undefined,
        halfBoardPrice: opt.halfBoardPrice ? Number(opt.halfBoardPrice) : undefined,
        fullBoardPrice: opt.fullBoardPrice ? Number(opt.fullBoardPrice) : undefined,
        includedServices: opt.includedServices || undefined,
        paymentPolicy: opt.paymentPolicy || undefined,
        cancellationPolicy: opt.cancellationPolicy || undefined,
        notes: opt.notes || undefined
      }));

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

    const response = await fetch(`/api/quotes/${currentQuote.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: adminApiHeaders(),
      body: JSON.stringify(payload)
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; data?: Quote; source?: string; error?: string } | null;
    setLoading(false);
    if (!response.ok || !result?.ok || !result.data) {
      setMessage(result?.error ?? "Salvataggio non riuscito");
      return;
    }
    setCurrentQuote(result.data);
    setMessage("Preventivo aggiornato.");
  }

  async function changeStatus(status: QuoteStatus) {
    const response = await fetch(`/api/quotes/${currentQuote.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: adminApiHeaders(),
      body: JSON.stringify({ statusOnly: true, status })
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; data?: Quote } | null;
    if (response.ok && result?.data) setCurrentQuote(result.data);
  }

  async function toggleExcludeFromStats() {
    setMessage(null);
    const next = !currentQuote.excludedFromStats;
    const response = await fetch(`/api/quotes/${currentQuote.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: adminApiHeaders(),
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
    const response = await fetch(`/api/quotes/${currentQuote.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: adminApiHeaders(),
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
    const response = await fetch(`/api/quotes/${currentQuote.id}`, {
      method: "POST",
      credentials: "include",
      headers: adminApiHeaders(),
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
    const response = await fetch(`/api/quotes/${currentQuote.id}`, {
      method: "POST",
      credentials: "include",
      headers: adminApiHeaders(),
      body: JSON.stringify({ action: "duplicate" })
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; data?: Quote; error?: string } | null;
    if (!response.ok || !result?.ok || !result.data) {
      setMessage(result?.error ?? "Duplicazione non riuscita");
      return;
    }
    window.location.href = `/admin/preventivi/${result.data.code}`;
  }

  const activeHotels = hotels.filter((h) => h.active);

  // Struttura selezionata dal cliente (se confermata con opzione)
  const selectedOption = getEffectiveHotelOptions(currentQuote).find((o) => o.isSelected);

  return (
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
          {selectedOption && (
            <div className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200">
              Scelta cliente: <strong>{selectedOption.hotelName}</strong> — {selectedOption.treatments.find((t) => t.key === selectedOption.treatments[0].key)?.label ?? "—"} — {selectedOption.isSelected ? "confermata" : ""}
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
        <div className="rounded-2xl bg-white/90 p-5 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-black text-ischia-navy">{currentQuote.code}</h2>
            <QuoteStatusBadge status={currentQuote.status} />
          </div>
          {getEffectiveHotelOptions(currentQuote).length > 0 && (
            <div className="mt-3 space-y-1 text-sm text-ischia-ink/70">
              {getEffectiveHotelOptions(currentQuote).map((opt) => (
                <p key={opt.id} className={opt.isSelected ? "font-bold text-emerald-700" : ""}>
                  {opt.isSelected ? "✓ " : ""}{opt.hotelName}
                  {opt.treatments.length > 0 && ` — ${opt.treatments.map((t) => formatCurrency(t.price)).join(" / ")}`}
                </p>
              ))}
            </div>
          )}
          <div className="mt-5 grid gap-2">
            <Link className="rounded-full bg-ischia-navy px-4 py-2 text-center text-sm font-black text-white" href={publicQuoteUrl(currentQuote)}>Apri link cliente</Link>
            <WhatsAppSendButton quote={currentQuote} />
            <button className="rounded-full bg-ischia-sun px-4 py-2 text-sm font-black text-ischia-navy" onClick={() => void duplicateCurrentQuote()} type="button">
              Duplica preventivo
            </button>
          </div>
        </div>

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
  );
}

function HotelOptionBlock({
  index,
  opt,
  activeHotels,
  total,
  onSelectHotel,
  onChange,
  onRemove
}: {
  index: number;
  opt: HotelOptionState;
  activeHotels: Hotel[];
  total: number;
  onSelectHotel: (id: string) => void;
  onChange: (patch: Partial<HotelOptionState>) => void;
  onRemove: () => void;
}) {
  const hasPrice = Boolean(opt.breakfastPrice || opt.halfBoardPrice || opt.fullBoardPrice);
  return (
    <div className="rounded-2xl border border-ischia-blue/15 bg-ischia-mist/50 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-black text-ischia-navy">Struttura {index + 1}</h3>
        {total > 1 && <button className="text-sm font-semibold text-rose-600" onClick={onRemove} type="button">Rimuovi</button>}
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
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="text-sm font-semibold text-ischia-ink">
          Camera e colazione (€)
          <input className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2" min="0" placeholder="vuoto = non mostrare" type="number" value={opt.breakfastPrice} onChange={(e) => onChange({ breakfastPrice: e.target.value })} />
        </label>
        <label className="text-sm font-semibold text-ischia-ink">
          Mezza pensione (€)
          <input className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2" min="0" placeholder="vuoto = non mostrare" type="number" value={opt.halfBoardPrice} onChange={(e) => onChange({ halfBoardPrice: e.target.value })} />
        </label>
        <label className="text-sm font-semibold text-ischia-ink">
          Pensione completa (€)
          <input className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2" min="0" placeholder="vuoto = non mostrare" type="number" value={opt.fullBoardPrice} onChange={(e) => onChange({ fullBoardPrice: e.target.value })} />
        </label>
      </div>
      {!hasPrice && (
        <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
          Inserisci almeno un prezzo per mostrare questa struttura nel preventivo.
        </p>
      )}
      <div className="mt-3 space-y-2">
        <Textarea label="Servizi inclusi" value={opt.includedServices} onChange={(v) => onChange({ includedServices: v })} />
        <Textarea label="Policy pagamento" value={opt.paymentPolicy} onChange={(v) => onChange({ paymentPolicy: v })} />
        <Textarea label="Policy cancellazione" value={opt.cancellationPolicy} onChange={(v) => onChange({ cancellationPolicy: v })} />
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
