"use client";

import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { fillMissingHotelPolicies } from "@/lib/hotel-policies";
import { extractHighlightedFeatures } from "@/lib/highlight-features";
import type { Hotel, QuoteHotelOption } from "@/lib/types";

export type RoomTypeState = {
  label: string;
  breakfastPrice: string;
  halfBoardPrice: string;
  fullBoardPrice: string;
};

export type HotelOptionState = {
  hotelGroup?: number;
  badge?: string;
  hotelReason?: string;
  breakfastDetails?: string;
  halfBoardDetails?: string;
  fullBoardDetails?: string;
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

const CUSTOM_ROOM_VALUE = "__custom__";

const HOTEL_REASON_QUICK_PHRASES = [
  "Struttura centrale, facile da raggiungere",
  "Ottimo rapporto qualità/prezzo",
  "Trattamento termale incluso",
  "Ideale per famiglie con bambini",
  "Vista mare garantita",
  "Struttura tranquilla, lontana dal caos",
  "Consigliato per coppie",
  "Uno dei più richiesti della stagione"
] as const;

const TREATMENT_DETAIL_QUICK_PHRASES = [
  "Bevande escluse",
  "Bevande incluse ai pasti",
  "Prima colazione a buffet",
  "Cena con menù fisso",
  "Accesso spa/terme incluso",
  "Spiaggia convenzionata inclusa",
  "Parcheggio incluso",
  "Transfer incluso",
  "Extra esclusi salvo diversa indicazione"
] as const;

const ROOM_TYPE_PRESETS = [
  { label: "Camera singola standard", capacity: 1 },
  { label: "Camera matrimoniale standard", capacity: 2 },
  { label: "Camera matrimoniale superior con balcone", capacity: 2 },
  { label: "Camera tripla standard", capacity: 3 },
  { label: "Camera tripla con balcone", capacity: 3 },
  { label: "Camera quadrupla standard", capacity: 4 },
  { label: "Camera quadrupla con balcone", capacity: 4 }
] as const;

export function emptyRoomType(): RoomTypeState {
  return { label: "", breakfastPrice: "", halfBoardPrice: "", fullBoardPrice: "" };
}

export function createHotelOption(hotel?: Hotel, hotelGroup?: number): HotelOptionState {
  const policies = hotelPolicies(hotel);
  return {
    hotelGroup,
    badge: "",
    hotelReason: "",
    breakfastDetails: "",
    halfBoardDetails: "",
    fullBoardDetails: "",
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

export function hotelOptionHasPrice(opt: HotelOptionState) {
  return opt.roomTypes.some(roomTypeHasPrice);
}

export function mapHotelOptionsToPayload(hotelOptions: HotelOptionState[], options: { preserveGroups?: boolean } = {}) {
  const mappedOptions: object[] = [];
  let globalPosition = 0;

  hotelOptions.filter(hotelOptionHasPrice).forEach((opt, hotelIdx) => {
    const hotelGroup = options.preserveGroups ? opt.hotelGroup ?? hotelIdx + 1 : hotelIdx + 1;
    opt.roomTypes.filter(roomTypeHasPrice).forEach((rt) => {
      globalPosition++;
      mappedOptions.push({
        hotelId: opt.hotelId || undefined,
        hotelGroup,
        position: globalPosition,
        badge: opt.badge || undefined,
        hotelReason: opt.hotelReason || undefined,
        breakfastDetails: opt.breakfastDetails || undefined,
        halfBoardDetails: opt.halfBoardDetails || undefined,
        fullBoardDetails: opt.fullBoardDetails || undefined,
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

  return mappedOptions;
}

export function quoteOptionsToHotelOptionState(opts: QuoteHotelOption[]): HotelOptionState[] {
  const groups = new Map<number, QuoteHotelOption[]>();
  for (const opt of opts) {
    const group = opt.hotelGroup ?? 1;
    const groupOpts = groups.get(group) ?? [];
    groupOpts.push(opt);
    groups.set(group, groupOpts);
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => a - b)
    .map(([groupId, groupOpts]) => {
      const first = groupOpts[0];
      return {
        hotelGroup: groupId,
        badge: first.badge ?? "",
        hotelReason: first.hotelReason ?? "",
        breakfastDetails: first.breakfastDetails ?? "",
        halfBoardDetails: first.halfBoardDetails ?? "",
        fullBoardDetails: first.fullBoardDetails ?? "",
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
        roomTypes: groupOpts.map((opt) => ({
          label: opt.roomTypeLabel ?? "",
          breakfastPrice: opt.breakfastPrice != null ? String(opt.breakfastPrice) : "",
          halfBoardPrice: opt.halfBoardPrice != null ? String(opt.halfBoardPrice) : "",
          fullBoardPrice: opt.fullBoardPrice != null ? String(opt.fullBoardPrice) : ""
        }))
      };
    });
}

export function hotelOptionStateToQuoteHotelOptions(opts: HotelOptionState[]): QuoteHotelOption[] {
  const result: QuoteHotelOption[] = [];
  let position = 0;
  const now = new Date().toISOString();

  opts.forEach((opt, groupIdx) => {
    const hotelGroup = opt.hotelGroup ?? groupIdx + 1;
    opt.roomTypes.forEach((rt, rtIdx) => {
      position++;
      const bPrice = rt.breakfastPrice ? Number(rt.breakfastPrice) : undefined;
      const hbPrice = rt.halfBoardPrice ? Number(rt.halfBoardPrice) : undefined;
      const fbPrice = rt.fullBoardPrice ? Number(rt.fullBoardPrice) : undefined;
      const treatments: QuoteHotelOption["treatments"] = [];
      if (bPrice) treatments.push({ key: "breakfast", label: "Camera e colazione", price: bPrice });
      if (hbPrice) treatments.push({ key: "half_board", label: "Mezza pensione", price: hbPrice });
      if (fbPrice) treatments.push({ key: "full_board", label: "Pensione completa", price: fbPrice });

      result.push({
        id: `preview-${groupIdx}-${rtIdx}`,
        quoteId: "preview",
        hotelId: opt.hotelId || undefined,
        hotelGroup,
        position,
        badge: opt.badge || undefined,
        hotelReason: opt.hotelReason || undefined,
        roomTypeLabel: rt.label || undefined,
        hotelName: opt.hotelName,
        hotelLocation: opt.hotelLocation || undefined,
        hotelStars: opt.hotelStars ? Number(opt.hotelStars) : undefined,
        hotelImageUrl: opt.hotelImageUrl || undefined,
        sourceUrl: opt.sourceUrl || undefined,
        breakfastPrice: bPrice,
        halfBoardPrice: hbPrice,
        fullBoardPrice: fbPrice,
        breakfastLabel: "Camera e colazione",
        halfBoardLabel: "Mezza pensione",
        fullBoardLabel: "Pensione completa",
        breakfastDetails: opt.breakfastDetails || undefined,
        halfBoardDetails: opt.halfBoardDetails || undefined,
        fullBoardDetails: opt.fullBoardDetails || undefined,
        includedServices: opt.includedServices || undefined,
        depositPercent: opt.depositPercent ? Number(opt.depositPercent) : undefined,
        balanceMethod: opt.balanceMethod || undefined,
        paymentPolicy: opt.paymentPolicy || undefined,
        cancellationPolicy: opt.cancellationPolicy || undefined,
        paymentNotes: opt.paymentNotes || undefined,
        notes: opt.notes || undefined,
        isSelected: false,
        createdAt: now,
        updatedAt: now,
        treatments,
      });
    });
  });

  return result;
}

export function suggestedGuestsPerRoom(totalGuests: number, rooms: number) {
  return Math.max(1, Math.ceil(Math.max(1, totalGuests) / Math.max(1, rooms)));
}

export function HotelOptionsEditor({
  hotelOptions,
  activeHotels,
  onChange,
  suggestedCapacity,
  preserveGroups = false,
  showDetectedPlus = false,
  showStars = true
}: {
  hotelOptions: HotelOptionState[];
  activeHotels: Hotel[];
  onChange: (next: HotelOptionState[]) => void;
  suggestedCapacity?: number;
  preserveGroups?: boolean;
  showDetectedPlus?: boolean;
  showStars?: boolean;
}) {
  function updateOption(index: number, patch: Partial<HotelOptionState>) {
    onChange(hotelOptions.map((opt, i) => (i === index ? { ...opt, ...patch } : opt)));
  }

  function selectHotel(index: number, hotelId: string) {
    const hotel = activeHotels.find((h) => h.id === hotelId);
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

  function updateRoomType(optIndex: number, roomIndex: number, patch: Partial<RoomTypeState>) {
    onChange(hotelOptions.map((opt, i) => {
      if (i !== optIndex) return opt;
      return { ...opt, roomTypes: opt.roomTypes.map((rt, j) => (j === roomIndex ? { ...rt, ...patch } : rt)) };
    }));
  }

  function addRoomType(optIndex: number) {
    onChange(hotelOptions.map((opt, i) => {
      if (i !== optIndex || opt.roomTypes.length >= 3) return opt;
      return { ...opt, roomTypes: [...opt.roomTypes, emptyRoomType()] };
    }));
  }

  function removeRoomType(optIndex: number, roomIndex: number) {
    onChange(hotelOptions.map((opt, i) => {
      if (i !== optIndex || opt.roomTypes.length <= 1) return opt;
      return { ...opt, roomTypes: opt.roomTypes.filter((_, j) => j !== roomIndex) };
    }));
  }

  function addOption() {
    if (hotelOptions.length >= 3) return;
    const usedIds = new Set(hotelOptions.map((opt) => opt.hotelId));
    const nextHotel = preserveGroups ? activeHotels.find((hotel) => !usedIds.has(hotel.id)) : undefined;
    const nextGroup = preserveGroups ? Math.max(0, ...hotelOptions.map((opt) => opt.hotelGroup ?? 0)) + 1 : undefined;
    onChange([...hotelOptions, createHotelOption(nextHotel, nextGroup)]);
  }

  function removeOption(index: number) {
    if (hotelOptions.length <= 1) return;
    onChange(hotelOptions.filter((_, i) => i !== index));
  }

  return (
    <>
      <div className="space-y-4">
        {hotelOptions.map((opt, index) => (
          <HotelOptionBlock
            key={index}
            index={index}
            opt={opt}
            activeHotels={activeHotels}
            total={hotelOptions.length}
            suggestedCapacity={suggestedCapacity}
            showDetectedPlus={showDetectedPlus}
            showStars={showStars}
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
    </>
  );
}

function HotelOptionBlock({
  index,
  opt,
  activeHotels,
  total,
  suggestedCapacity,
  showDetectedPlus,
  showStars,
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
  suggestedCapacity?: number;
  showDetectedPlus: boolean;
  showStars: boolean;
  onSelectHotel: (id: string) => void;
  onChange: (patch: Partial<HotelOptionState>) => void;
  onRemove: () => void;
  onUpdateRoomType: (roomIndex: number, patch: Partial<RoomTypeState>) => void;
  onAddRoomType: () => void;
  onRemoveRoomType: (roomIndex: number) => void;
}) {
  const hasPrice = hotelOptionHasPrice(opt);
  const detectedPlus = showDetectedPlus ? extractHighlightedFeatures({
    hotelName: opt.hotelName,
    includedServices: opt.includedServices,
    notes: opt.notes
  }) : [];

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

      <div className="grid gap-3 sm:grid-cols-2">
        {activeHotels.length > 0 && (
          <label className="col-span-2 text-sm font-semibold text-ischia-ink sm:col-span-1">
            Seleziona da DB
            <select
              className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2"
              value={opt.hotelId}
              onChange={(e) => onSelectHotel(e.target.value)}
            >
              <option value="">- Digita nome manualmente -</option>
              {activeHotels.map((hotel) => (
                <option key={hotel.id} value={hotel.id}>{hotel.name}</option>
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
          Badge commerciale
          <select
            className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2"
            value={opt.badge ?? ""}
            onChange={(e) => onChange({ badge: e.target.value })}
          >
            <option value="">Nessun badge</option>
            <option value="Consigliato">Consigliato</option>
            <option value="Miglior prezzo">Miglior prezzo</option>
            <option value="Più richiesto">Più richiesto</option>
            <option value="Soluzione premium">Soluzione premium</option>
            <option value="Ideale per famiglie">Ideale per famiglie</option>
            <option value="Vicino al mare">Vicino al mare</option>
          </select>
        </label>
        <div className="sm:col-span-2">
          <p className="text-xs font-bold uppercase tracking-wide text-ischia-blue/70">Frasi rapide</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {HOTEL_REASON_QUICK_PHRASES.map((phrase) => (
              <button
                key={phrase}
                className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs text-ischia-ink transition hover:border-[#C9A84C] hover:bg-[#FBF5E6]"
                onClick={() => {
                  const current = opt.hotelReason?.trim();
                  onChange({ hotelReason: current ? `${current}, ${phrase}` : phrase });
                }}
                type="button"
              >
                {phrase}
              </button>
            ))}
          </div>
          <label className="mt-3 block text-sm font-semibold text-ischia-ink">
            Perché te lo proponiamo
            <textarea
              className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2"
              placeholder="Scrivi una motivazione oppure seleziona una frase rapida sopra."
              rows={2}
              value={opt.hotelReason ?? ""}
              onChange={(e) => onChange({ hotelReason: e.target.value })}
            />
          </label>
        </div>
        {showStars ? (
          <label className="text-sm font-semibold text-ischia-ink">
            Stelle
            <input className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2" max="5" min="1" type="number" value={opt.hotelStars} onChange={(e) => onChange({ hotelStars: e.target.value })} />
          </label>
        ) : null}
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
            <div className="mb-2 grid gap-2 sm:grid-cols-[0.9fr_1.1fr_auto] sm:items-end">
              <RoomTypeSelect
                label={opt.roomTypes.length > 1 ? `Tipologia ${roomIdx + 1}` : "Tipologia camera"}
                roomLabel={rt.label}
                suggestedCapacity={suggestedCapacity}
                onChange={(label) => onUpdateRoomType(roomIdx, { label })}
              />
              <label className="text-sm font-semibold text-ischia-ink">
                Nome editabile
                <input
                  className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2"
                  placeholder="Scrivi una nuova categoria..."
                  value={rt.label}
                  onChange={(e) => onUpdateRoomType(roomIdx, { label: e.target.value })}
                />
              </label>
              {opt.roomTypes.length > 1 && (
                <button className="text-xs font-semibold text-rose-500 sm:mb-2" onClick={() => onRemoveRoomType(roomIdx)} type="button">
                  Rimuovi
                </button>
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

      <div className="mt-4 space-y-3">
        {opt.roomTypes.some((room) => Boolean(room.breakfastPrice)) ? (
          <TreatmentDetailsEditor
            label="Camera e colazione"
            placeholder="Es. Pernottamento e colazione a buffet. Bevande escluse."
            value={opt.breakfastDetails ?? ""}
            onChange={(breakfastDetails) => onChange({ breakfastDetails })}
          />
        ) : null}
        {opt.roomTypes.some((room) => Boolean(room.halfBoardPrice)) ? (
          <TreatmentDetailsEditor
            label="Mezza pensione"
            placeholder="Es. Pernottamento, colazione e cena. Bevande escluse salvo diversa indicazione."
            value={opt.halfBoardDetails ?? ""}
            onChange={(halfBoardDetails) => onChange({ halfBoardDetails })}
          />
        ) : null}
        {opt.roomTypes.some((room) => Boolean(room.fullBoardPrice)) ? (
          <TreatmentDetailsEditor
            label="Pensione completa"
            placeholder="Es. Pernottamento, colazione, pranzo e cena. Bevande incluse ai pasti."
            value={opt.fullBoardDetails ?? ""}
            onChange={(fullBoardDetails) => onChange({ fullBoardDetails })}
          />
        ) : null}
      </div>

      {!hasPrice && (
        <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
          Inserisci almeno un prezzo per mostrare questa struttura nel preventivo.
        </p>
      )}

      <div className="mt-3 space-y-2">
        <Textarea label="Servizi inclusi" value={opt.includedServices} onChange={(value) => onChange({ includedServices: value })} />
        <div className="grid gap-2 sm:grid-cols-2">
          <Input label="Acconto (%)" min="0" step="0.01" type="number" value={opt.depositPercent} onChange={(e) => onChange({ depositPercent: e.target.value })} />
          <Input label="Modalita saldo" value={opt.balanceMethod} onChange={(e) => onChange({ balanceMethod: e.target.value })} />
        </div>
        <Textarea label="Policy pagamento" value={opt.paymentPolicy} onChange={(value) => onChange({ paymentPolicy: value })} />
        <Textarea label="Policy cancellazione" value={opt.cancellationPolicy} onChange={(value) => onChange({ cancellationPolicy: value })} />
        <Textarea label="Note pagamento" value={opt.paymentNotes} onChange={(value) => onChange({ paymentNotes: value })} />
        <Textarea label="Note per il cliente" value={opt.notes} onChange={(value) => onChange({ notes: value })} />
      </div>

      {detectedPlus.length > 0 && (
        <div className="mt-3 rounded-xl bg-emerald-50/60 p-3 ring-1 ring-emerald-200/50">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">Plus rilevati (anteprima preventivo)</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {detectedPlus.map((feature) => (
              <span key={feature} className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                ✓ {feature}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RoomTypeSelect({
  label,
  roomLabel,
  suggestedCapacity,
  onChange
}: {
  label: string;
  roomLabel: string;
  suggestedCapacity?: number;
  onChange: (label: string) => void;
}) {
  const normalizedCapacity = suggestedCapacity != null ? Math.min(4, Math.max(1, suggestedCapacity)) : undefined;
  const recommended = normalizedCapacity ? ROOM_TYPE_PRESETS.filter((preset) => preset.capacity === normalizedCapacity) : [];
  const otherPresets = ROOM_TYPE_PRESETS.filter((preset) => !recommended.some((item) => item.label === preset.label));
  const selectedPreset = ROOM_TYPE_PRESETS.find((preset) => preset.label === roomLabel);
  const selectedValue = selectedPreset?.label ?? CUSTOM_ROOM_VALUE;

  return (
    <label className="text-sm font-semibold text-ischia-ink">
      {label}
      <select
        className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2"
        value={selectedValue}
        onChange={(event) => {
          if (event.target.value === CUSTOM_ROOM_VALUE) return;
          onChange(event.target.value);
        }}
      >
        <option value={CUSTOM_ROOM_VALUE}>Personalizzata</option>
        {recommended.length > 0 ? (
          <optgroup label={`Consigliate per ${normalizedCapacity} ${normalizedCapacity === 1 ? "persona" : "persone"}`}>
            {recommended.map((preset) => (
              <option key={preset.label} value={preset.label}>{preset.label}</option>
            ))}
          </optgroup>
        ) : null}
        <optgroup label="Altre tipologie">
          {otherPresets.map((preset) => (
            <option key={preset.label} value={preset.label}>{preset.label}</option>
          ))}
        </optgroup>
      </select>
    </label>
  );
}

function TreatmentDetailsEditor({
  label,
  placeholder,
  value,
  onChange
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="rounded-xl border border-ischia-blue/10 bg-white p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-ischia-blue/70">Dettagli {label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {TREATMENT_DETAIL_QUICK_PHRASES.map((phrase) => (
          <button
            key={phrase}
            className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs text-ischia-ink transition hover:border-[#C9A84C] hover:bg-[#FBF5E6]"
            onClick={() => {
              const current = value.trim();
              onChange(current ? `${current}, ${phrase}` : phrase);
            }}
            type="button"
          >
            {phrase}
          </button>
        ))}
      </div>
      <label className="mt-3 block text-sm font-semibold text-ischia-ink">
        Cosa include — {label}
        <textarea
          className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2"
          placeholder={placeholder}
          rows={2}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
    </div>
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
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        {...props}
      />
    </label>
  );
}

function roomTypeHasPrice(rt: RoomTypeState) {
  return Boolean(rt.breakfastPrice || rt.halfBoardPrice || rt.fullBoardPrice);
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
