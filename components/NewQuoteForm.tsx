"use client";

import Link from "next/link";
import type { FormEvent, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { useState } from "react";
import { WhatsAppSendButton } from "@/components/WhatsAppSendButton";
import { adminApiHeaders } from "@/lib/admin-api-client";
import { Hotel, Quote, QuoteRequest } from "@/lib/types";
import { publicQuoteUrl } from "@/lib/utils";

type SavedQuote = Quote | null;

type RoomTypeState = {
  label: string;
  breakfastPrice: string;
  halfBoardPrice: string;
  fullBoardPrice: string;
};

type HotelOptionState = {
  hotelId: string;
  hotelName: string;
  hotelLocation: string;
  hotelStars: string;
  includedServices: string;
  paymentPolicy: string;
  cancellationPolicy: string;
  notes: string;
  roomTypes: RoomTypeState[];
};

function emptyRoomType(): RoomTypeState {
  return { label: "", breakfastPrice: "", halfBoardPrice: "", fullBoardPrice: "" };
}

function emptyOption(hotel?: Hotel): HotelOptionState {
  return {
    hotelId: hotel?.id ?? "",
    hotelName: hotel?.name ?? "",
    hotelLocation: hotel?.zone ?? "",
    hotelStars: hotel ? String(hotel.stars) : "",
    includedServices: hotel?.standardServices.join("\n") ?? "",
    paymentPolicy: hotel?.paymentPolicy ?? "",
    cancellationPolicy: hotel?.cancellationPolicy ?? "",
    notes: "",
    roomTypes: [emptyRoomType()]
  };
}

export function NewQuoteForm({ hotels, initialRequest, requestedRequestId }: { hotels: Hotel[]; initialRequest?: QuoteRequest | null; requestedRequestId?: string }) {
  const activeHotels = hotels.filter((h) => h.active);
  const [childrenCount, setChildrenCount] = useState(initialRequest?.children.length ?? 0);
  const [savedQuote, setSavedQuote] = useState<SavedQuote>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hotelOptions, setHotelOptions] = useState<HotelOptionState[]>([emptyOption(activeHotels[0])]);

  function updateOption(index: number, patch: Partial<HotelOptionState>) {
    setHotelOptions((prev) => prev.map((opt, i) => (i === index ? { ...opt, ...patch } : opt)));
  }

  function selectHotel(index: number, hotelId: string) {
    const hotel = activeHotels.find((h) => h.id === hotelId);
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

  function addOption() {
    if (hotelOptions.length >= 3) return;
    const usedIds = new Set(hotelOptions.map((o) => o.hotelId));
    const nextHotel = activeHotels.find((h) => !usedIds.has(h.id));
    setHotelOptions((prev) => [...prev, emptyOption(nextHotel)]);
  }

  function removeOption(index: number) {
    if (hotelOptions.length <= 1) return;
    setHotelOptions((prev) => prev.filter((_, i) => i !== index));
  }

  function optionHasPrice(opt: HotelOptionState) {
    return opt.roomTypes.some((rt) => rt.breakfastPrice || rt.halfBoardPrice || rt.fullBoardPrice);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const hasAtLeastOnePrice = hotelOptions.some(optionHasPrice);
    if (!hasAtLeastOnePrice) {
      setError("Inserisci almeno un prezzo in almeno una struttura per generare il preventivo.");
      setLoading(false);
      return;
    }

    const formData = new FormData(event.currentTarget);
    const children = Array.from({ length: childrenCount }, (_, index) => ({ birthDate: String(formData.get(`child-${index}`) ?? "") }));
    if (children.some((c) => !c.birthDate)) {
      setError("Inserisci la data di nascita per ogni bambino.");
      setLoading(false);
      return;
    }

    // Espandi ogni hotel in righe separate per tipologia camera
    const mappedOptions: object[] = [];
    let globalPosition = 0;
    hotelOptions.filter(optionHasPrice).forEach((opt, hotelIdx) => {
      const hotelGroup = hotelIdx + 1;
      opt.roomTypes
        .filter((rt) => rt.breakfastPrice || rt.halfBoardPrice || rt.fullBoardPrice)
        .forEach((rt) => {
          globalPosition++;
          mappedOptions.push({
            hotelId: opt.hotelId || undefined,
            hotelGroup,
            position: globalPosition,
            roomTypeLabel: rt.label || undefined,
            hotelName: opt.hotelName,
            hotelLocation: opt.hotelLocation || undefined,
            hotelStars: opt.hotelStars ? Number(opt.hotelStars) : undefined,
            breakfastPrice: rt.breakfastPrice ? Number(rt.breakfastPrice) : undefined,
            halfBoardPrice: rt.halfBoardPrice ? Number(rt.halfBoardPrice) : undefined,
            fullBoardPrice: rt.fullBoardPrice ? Number(rt.fullBoardPrice) : undefined,
            includedServices: opt.includedServices || undefined,
            paymentPolicy: opt.paymentPolicy || undefined,
            cancellationPolicy: opt.cancellationPolicy || undefined,
            notes: opt.notes || undefined
          });
        });
    });

    const response = await fetch("/api/quotes", {
      method: "POST",
      credentials: "include",
      headers: adminApiHeaders(),
      body: JSON.stringify({
        clientFirstName: formData.get("firstName"),
        clientLastName: formData.get("lastName"),
        clientPhone: formData.get("phone"),
        clientEmail: formData.get("email"),
        checkIn: formData.get("checkIn"),
        checkOut: formData.get("checkOut"),
        adults: Number(formData.get("adults") ?? 2),
        children,
        rooms: Number(formData.get("rooms") ?? 1),
        quoteRequestId: initialRequest?.id,
        hotelRequested: formData.get("hotelRequested"),
        hotelId: hotelOptions[0]?.hotelId || undefined,
        totalPrice: 0,
        depositAmount: Number(formData.get("depositAmount") ?? 0),
        validUntil: formData.get("validUntil"),
        publicNotes: formData.get("publicNotes"),
        internalNotes: formData.get("internalNotes"),
        hotelOptions: mappedOptions
      })
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; data?: Quote; error?: string } | null;
    setLoading(false);
    if (!response.ok || !result?.ok || !result.data) {
      setError(result?.error ?? `Preventivo non salvato (${response.status}). Riprova o verifica la sessione operatore.`);
      return;
    }
    setSavedQuote(result.data);
  }

  if (!activeHotels.length) {
    return <div className="rounded-2xl bg-white/90 p-6 text-sm font-semibold text-ischia-ink/70 shadow-soft">Configura almeno un hotel attivo prima di creare un preventivo.</div>;
  }

  if (savedQuote) {
    return (
      <section className="rounded-2xl bg-white/90 p-6 shadow-soft">
        <p className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800 ring-1 ring-emerald-100">
          Preventivo generato. La richiesta non compare piu tra i preventivi da evadere.
        </p>
        <div className="mt-5 grid gap-4 text-sm">
          <div>
            <p className="font-black text-ischia-navy">Codice preventivo</p>
            <p className="mt-1 text-lg font-black text-ischia-ink">{savedQuote.code}</p>
          </div>
          <div>
            <p className="font-black text-ischia-navy">Link cliente</p>
            <p className="mt-1 break-all rounded-xl bg-ischia-mist px-3 py-2 font-semibold text-ischia-ink">{publicQuoteUrl(savedQuote)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <WhatsAppSendButton quote={savedQuote} />
            <Link className="rounded-full bg-ischia-navy px-4 py-2 font-black text-white" href={publicQuoteUrl(savedQuote)}>
              Apri link cliente
            </Link>
            <Link className="rounded-full bg-white px-4 py-2 font-black text-ischia-navy ring-1 ring-ischia-blue/20" href={`/admin/preventivi/${savedQuote.code}`}>
              Dettaglio preventivo
            </Link>
            <Link className="rounded-full bg-white px-4 py-2 font-black text-ischia-navy ring-1 ring-ischia-blue/20" href="/admin/preventivi">
              Tutti i preventivi
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_0.36fr]">
      <form className="space-y-5" onSubmit={submit}>
        {initialRequest ? (
          <div className="rounded-2xl bg-ischia-sun/20 p-4 text-sm font-semibold text-ischia-navy ring-1 ring-ischia-sun/35">
            Stai creando un preventivo dalla richiesta di {initialRequest.firstName} {initialRequest.lastName}. I dati cliente e soggiorno sono stati precompilati.
          </div>
        ) : requestedRequestId ? (
          <div className="rounded-2xl bg-rose-50 p-4 text-sm font-semibold text-rose-700 ring-1 ring-rose-100">
            Richiesta non trovata. Puoi comunque creare un preventivo manuale.
          </div>
        ) : null}
        {error ? <p className="rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700 ring-1 ring-rose-100">{error}</p> : null}

        <Section title="Cliente e soggiorno">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input name="firstName" label="Nome cliente" required defaultValue={initialRequest?.firstName} />
            <Input name="lastName" label="Cognome cliente" required defaultValue={initialRequest?.lastName} />
            <Input name="phone" label="Telefono WhatsApp" required defaultValue={initialRequest?.phone} />
            <Input name="email" label="Email" required type="email" defaultValue={initialRequest?.email} />
            <Input name="checkIn" label="Data arrivo" required type="date" defaultValue={initialRequest?.arrivalDate} />
            <Input name="checkOut" label="Data partenza" required type="date" defaultValue={initialRequest?.departureDate} />
            <Input name="adults" label="Adulti" required type="number" defaultValue={String(initialRequest?.adults ?? 2)} />
            <Input label="Numero bambini" type="number" value={String(childrenCount)} onChange={(e) => setChildrenCount(Number(e.target.value))} min="0" />
            {Array.from({ length: childrenCount }, (_, index) => (
              <Input key={index} name={`child-${index}`} label={`Data nascita bambino ${index + 1}`} required type="date" defaultValue={initialRequest?.children[index]?.birthDate} />
            ))}
            <Input name="rooms" label="Camere" required type="number" defaultValue={String(initialRequest?.rooms ?? 1)} />
            <Input name="hotelRequested" label="Hotel richiesto dal cliente" placeholder="Es. Hotel Terme Felix" defaultValue={initialRequest?.requestedHotel} />
          </div>
        </Section>

        <Section title="Proposte hotel">
          <p className="text-sm text-ischia-ink/65">Inserisci fino a 3 strutture. Ogni struttura può avere uno o più trattamenti con prezzo. Solo i trattamenti con prezzo vengono mostrati al cliente.</p>
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
          <div className="grid gap-3 sm:grid-cols-2">
            <Input name="depositAmount" label="Acconto richiesto (€)" type="number" defaultValue="0" />
            <Input name="validUntil" label="Validita offerta" required type="date" />
          </div>
          <Textarea name="publicNotes" label="Note visibili al cliente" />
          <Textarea name="internalNotes" label="Note interne" defaultValue={initialRequest?.message} />
        </Section>

        <button
          className="w-full rounded-full bg-ischia-sun px-5 py-3 font-black text-ischia-navy disabled:opacity-60 sm:w-auto"
          disabled={loading}
          type="submit"
        >
          {loading ? "Creo il preventivo..." : "Genera preventivo"}
        </button>
      </form>

      <aside className="space-y-4">
        <div className="rounded-2xl bg-white/90 p-5 shadow-soft">
          <h2 className="text-xl font-black text-ischia-navy">Come funziona</h2>
          <ul className="mt-3 space-y-2 text-sm text-ischia-ink/70">
            <li>Aggiungi fino a 3 strutture hotel.</li>
            <li>Per ogni struttura inserisci il prezzo dei trattamenti che vuoi proporre.</li>
            <li>Il cliente vede solo i trattamenti con prezzo e sceglie quello preferito.</li>
            <li>Se una struttura non ha prezzi, non viene mostrata.</li>
          </ul>
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
  onRemove,
  onUpdateRoomType,
  onAddRoomType,
  onRemoveRoomType
}: {
  index: number;
  opt: HotelOptionState;
  activeHotels: Hotel[];
  total: number;
  onSelectHotel: (id: string) => void;
  onChange: (patch: Partial<HotelOptionState>) => void;
  onRemove: () => void;
  onUpdateRoomType: (roomIndex: number, patch: Partial<RoomTypeState>) => void;
  onAddRoomType: () => void;
  onRemoveRoomType: (roomIndex: number) => void;
}) {
  const hasPrice = opt.roomTypes.some((rt) => rt.breakfastPrice || rt.halfBoardPrice || rt.fullBoardPrice);

  return (
    <div className="rounded-2xl border border-ischia-blue/15 bg-ischia-mist/50 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-black text-ischia-navy">Struttura {index + 1}</h3>
        {total > 1 && (
          <button className="text-sm font-semibold text-rose-600" onClick={onRemove} type="button">
            Rimuovi struttura
          </button>
        )}
      </div>

      {/* Selezione hotel e info */}
      <div className="grid gap-3 sm:grid-cols-2">
        {activeHotels.length > 0 && (
          <label className="col-span-2 text-sm font-semibold text-ischia-ink sm:col-span-1">
            Seleziona da DB
            <select
              className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2"
              value={opt.hotelId}
              onChange={(e) => onSelectHotel(e.target.value)}
            >
              <option value="">— Digita nome manualmente —</option>
              {activeHotels.map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
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
        <label className="text-sm font-semibold text-ischia-ink">
          Stelle
          <input className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2" max="5" min="1" type="number" value={opt.hotelStars} onChange={(e) => onChange({ hotelStars: e.target.value })} />
        </label>
      </div>

      {/* Tipologie camera con prezzi */}
      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wide text-ischia-blue/70">Tipologie camera e prezzi</p>
          {opt.roomTypes.length < 3 && (
            <button className="rounded-full bg-ischia-mist px-3 py-1 text-xs font-black text-ischia-navy ring-1 ring-ischia-blue/15" onClick={onAddRoomType} type="button">
              + Aggiungi camera ({opt.roomTypes.length}/3)
            </button>
          )}
        </div>

        {opt.roomTypes.map((rt, roomIdx) => (
          <div key={roomIdx} className="rounded-xl border border-ischia-blue/10 bg-white p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <label className="flex-1 text-sm font-semibold text-ischia-ink">
                {opt.roomTypes.length > 1 ? `Tipologia camera ${roomIdx + 1}` : "Tipologia camera (opzionale)"}
                <input
                  className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2"
                  placeholder="es. Camera Doppia, Camera Superior, Suite..."
                  value={rt.label}
                  onChange={(e) => onUpdateRoomType(roomIdx, { label: e.target.value })}
                />
              </label>
              {opt.roomTypes.length > 1 && (
                <button className="mt-5 text-xs font-semibold text-rose-500" onClick={() => onRemoveRoomType(roomIdx)} type="button">Rimuovi</button>
              )}
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="text-xs font-semibold text-ischia-ink">
                Camera e colazione (€)
                <input className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-2 py-1.5 text-sm" min="0" placeholder="vuoto = no" type="number" value={rt.breakfastPrice} onChange={(e) => onUpdateRoomType(roomIdx, { breakfastPrice: e.target.value })} />
              </label>
              <label className="text-xs font-semibold text-ischia-ink">
                Mezza pensione (€)
                <input className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-2 py-1.5 text-sm" min="0" placeholder="vuoto = no" type="number" value={rt.halfBoardPrice} onChange={(e) => onUpdateRoomType(roomIdx, { halfBoardPrice: e.target.value })} />
              </label>
              <label className="text-xs font-semibold text-ischia-ink">
                Pensione completa (€)
                <input className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-2 py-1.5 text-sm" min="0" placeholder="vuoto = no" type="number" value={rt.fullBoardPrice} onChange={(e) => onUpdateRoomType(roomIdx, { fullBoardPrice: e.target.value })} />
              </label>
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
        <Textarea label="Policy pagamento" value={opt.paymentPolicy} onChange={(v) => onChange({ paymentPolicy: v })} />
        <Textarea label="Policy cancellazione" value={opt.cancellationPolicy} onChange={(v) => onChange({ cancellationPolicy: v })} />
        <Textarea label="Note per il cliente (opzionale)" value={opt.notes} onChange={(v) => onChange({ notes: v })} />
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-white/90 p-5 shadow-soft">
      <h2 className="text-xl font-black text-ischia-navy">{title}</h2>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

function Input({ label, ...props }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="text-sm font-semibold text-ischia-ink">
      {label}
      <input className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2" {...props} />
    </label>
  );
}

function Textarea({ label, value, onChange, ...props }: { label: string; value?: string; onChange?: (value: string) => void } & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value">) {
  return (
    <label className="block text-sm font-semibold text-ischia-ink">
      {label}
      <textarea
        className="mt-1 min-h-20 w-full rounded-xl border border-ischia-blue/20 px-3 py-2"
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        {...props}
      />
    </label>
  );
}
