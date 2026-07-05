"use client";

import type { FormEvent, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createHotelOption,
  HotelOptionState,
  HotelOptionsEditor,
  hotelOptionHasPrice,
  mapHotelOptionsToPayload,
  suggestedGuestsPerRoom,
  suggestedRoomTypeLabel
} from "@/components/HotelOptionsEditor";
import { adminApiErrorMessage, adminApiFetch, readAdminApiJson } from "@/lib/admin-api-client";
import { adminApiHeaders } from "@/lib/admin-api-client";
import { Hotel, Quote, QuoteRequest } from "@/lib/types";

type ClientResult = { firstName: string; lastName: string; email: string; phone: string };

const PUBLIC_NOTE_CHIPS = [
  "Traghetto da Napoli € 33 a persona a/r con transfer",
  "Ultime disponibilità",
  "Costi intesi per ogni camera",
  "Quota cane 20 euro al giorno da pagare in loco"
];

function todayDateString() {
  return new Date().toISOString().split("T")[0];
}

function tomorrowDateString() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().split("T")[0];
}

function ClientSearch({ onSelect }: { onSelect: (c: ClientResult) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ClientResult[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.length < 2) { setResults([]); setOpen(false); return; }
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/clients?q=${encodeURIComponent(query)}`, { headers: adminApiHeaders() });
      const data = await res.json().catch(() => null) as { ok?: boolean; data?: ClientResult[] } | null;
      const clients = data?.data ?? [];
      setResults(clients);
      setOpen(clients.length > 0);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="relative sm:col-span-2" ref={ref}>
      <label className="text-sm font-semibold text-ischia-ink">
        Cerca cliente esistente
        <input
          autoComplete="off"
          className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2 text-sm"
          placeholder="Nome, cognome, email o telefono…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      {open && (
        <ul className="absolute z-20 mt-1 w-full rounded-xl border border-ischia-blue/20 bg-white shadow-lg">
          {results.map((c, i) => (
            <li key={i}>
              <button
                className="w-full px-4 py-3 text-left text-sm hover:bg-ischia-mist"
                type="button"
                onClick={() => { onSelect(c); setQuery(""); setOpen(false); }}
              >
                <span className="font-bold text-ischia-navy">{c.firstName} {c.lastName}</span>
                <span className="ml-2 text-ischia-ink/60">{c.email} · {c.phone}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function NewQuoteForm({ hotels, initialRequest, requestedRequestId, isLabTest = false, manualConfirmation = false }: { hotels: Hotel[]; initialRequest?: QuoteRequest | null; requestedRequestId?: string; isLabTest?: boolean; manualConfirmation?: boolean }) {
  const router = useRouter();
  const activeHotels = hotels.filter((h) => h.active);
  const requestedHotelName = initialRequest?.requestedHotel?.trim() ?? "";
  const requestedHotelMatch = requestedHotelName ? findRequestedHotelInDb(requestedHotelName, activeHotels) : undefined;
  const [childrenCount, setChildrenCount] = useState(initialRequest?.children.length ?? 0);
  const [adultsCount, setAdultsCount] = useState(initialRequest?.adults ?? 2);
  const [roomsCount, setRoomsCount] = useState(initialRequest?.rooms ?? 1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isAlternativeOffer, setIsAlternativeOffer] = useState(false);
  const [hotelOptions, setHotelOptions] = useState<HotelOptionState[]>([createHotelOption(requestedHotelMatch)]);
  const [firstName, setFirstName] = useState(initialRequest?.firstName ?? "");
  const [lastName, setLastName] = useState(initialRequest?.lastName ?? "");
  const [phone, setPhone] = useState(initialRequest?.phone ?? "");
  const [email, setEmail] = useState(initialRequest?.email ?? "");
  const [checkIn, setCheckIn] = useState(initialRequest?.arrivalDate ?? "");
  const [checkOut, setCheckOut] = useState(initialRequest?.departureDate ?? "");
  const roomCapacitySuggestion = suggestedGuestsPerRoom(adultsCount + childrenCount, roomsCount);

  const requestedHotelMissing = Boolean(requestedHotelName && !requestedHotelMatch);
  const firstProposedHotel = hotelOptions[0];
  const isDifferentFromRequested = requestedHotelMatch
    ? Boolean(firstProposedHotel?.hotelId && firstProposedHotel.hotelId !== requestedHotelMatch.id)
    : Boolean(
        requestedHotelName &&
        firstProposedHotel?.hotelName &&
        normalizeHotelMatchName(firstProposedHotel.hotelName) !== normalizeHotelMatchName(requestedHotelName)
      );
  const showAlternativeWarning = isDifferentFromRequested && !isAlternativeOffer;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    if (manualConfirmation && (!firstName.trim() || !lastName.trim() || !phone.trim() || !email.trim())) {
      setError("Per preparare il voucher inserisci nome, cognome, telefono ed email del cliente.");
      setLoading(false);
      return;
    }
    if (manualConfirmation && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Inserisci un indirizzo email valido.");
      setLoading(false);
      return;
    }

    const hasAtLeastOnePrice = hotelOptions.some(hotelOptionHasPrice);
    if (!hasAtLeastOnePrice) {
      setError("Inserisci almeno un prezzo in almeno una struttura per generare il preventivo.");
      setLoading(false);
      return;
    }

    const formData = new FormData(event.currentTarget);
    const children = Array.from({ length: childrenCount }, (_, index) => ({ age: Number(formData.get(`child-${index}`) ?? "") }));
    if (children.some((c) => isNaN(c.age) || c.age < 0 || c.age > 17)) {
      setError("Inserisci l'età (0–17 anni) per ogni bambino.");
      setLoading(false);
      return;
    }

    const mappedOptions = mapHotelOptionsToPayload(hotelOptions, {
      defaultRoomTypeLabel: suggestedRoomTypeLabel(roomCapacitySuggestion)
    });
    if (manualConfirmation && countPricedTreatments(hotelOptions) !== 1) {
      setError("Per importare una conferma via email inserisci una sola struttura e un solo trattamento con prezzo.");
      setLoading(false);
      return;
    }

    const response = await adminApiFetch("/api/quotes", {
      method: "POST",
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
        alternativeHotelId: isAlternativeOffer ? hotelOptions[0]?.hotelId || undefined : undefined,
        isAlternativeOffer,
        totalPrice: 0,
        depositAmount: Number(formData.get("depositAmount") ?? 0),
        validUntil: formData.get("validUntil"),
        publicNotes: formData.get("publicNotes"),
        internalNotes: formData.get("internalNotes"),
        hotelOptions: mappedOptions,
        isLabTest
      })
    });
    const result = await readAdminApiJson<{ ok?: boolean; data?: Quote; error?: string }>(response);
    setLoading(false);
    if (!response.ok || !result?.ok || !result.data) {
      setError(adminApiErrorMessage(response, result, `Preventivo non salvato (${response.status}). Riprova o verifica la sessione operatore.`));
      return;
    }

    if (manualConfirmation) {
      const confirmationResponse = await adminApiFetch(`/api/quotes/${result.data.id}/manual-confirmation`, {
        method: "POST",
        body: JSON.stringify({})
      });
      const confirmationResult = await readAdminApiJson<{ ok?: boolean; quote?: Quote; error?: string }>(confirmationResponse);
      if (!confirmationResponse.ok || !confirmationResult?.ok) {
        setError(adminApiErrorMessage(confirmationResponse, confirmationResult, "Preventivo creato, ma conferma manuale non registrata."));
        return;
      }

      router.push(`/admin/preventivi/${result.data.code}#verifica-disponibilita`);
      router.refresh();
      return;
    }

    if (isLabTest) {
      const quoteId = result.data.id;
      await adminApiFetch(`/api/quotes/${quoteId}`, {
        method: "PATCH",
        body: JSON.stringify({ excludedFromStats: true })
      }).catch((err) => console.error("Esclusione statistiche preventivo di test non riuscita", err));
      await adminApiFetch("/api/supervisor/test-quotes/mark-lab", {
        method: "PATCH",
        body: JSON.stringify({ quoteId })
      }).catch((err) => console.error("Marcatura preventivo di test non riuscita", err));

      router.push("/admin/lab");
      router.refresh();
      return;
    }

    const sendResponse = await adminApiFetch(`/api/quotes/${result.data.id}`, {
      method: "POST",
      body: JSON.stringify({ action: "send" })
    }).catch(() => null);
    const sendResult = sendResponse
      ? await readAdminApiJson<{ ok?: boolean; error?: string }>(sendResponse)
      : null;
    const emailFailed = !sendResponse?.ok || !sendResult?.ok;

    router.push(`/admin/preventivi/${result.data.code}${emailFailed ? "?email_error=1" : ""}`);
    router.refresh();
  }

  if (!activeHotels.length) {
    return <div className="rounded-2xl bg-white/90 p-6 text-sm font-semibold text-ischia-ink/70 shadow-soft">Configura almeno un hotel attivo prima di creare un preventivo.</div>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_0.36fr]">
      <form className="space-y-5" onSubmit={submit}>
        {isLabTest ? (
          <div className="rounded-2xl bg-[#4C1D95] px-4 py-3 text-sm font-semibold text-white">
            🔬 Modalità test — questo preventivo sarà invisibile a Diego e non conterrà nelle statistiche
          </div>
        ) : null}
        {manualConfirmation ? (
          <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900 ring-1 ring-emerald-200">
            Importazione conferma ricevuta via email. Inserisci solo la struttura e il trattamento realmente confermati: la prenotazione sarà pronta per generare il voucher.
          </div>
        ) : null}
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
        {requestedHotelMissing ? (
          <p className="rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-900 ring-1 ring-amber-200">
            Hotel richiesto non trovato nel database. Seleziona manualmente la struttura da proporre.
          </p>
        ) : null}
        {showAlternativeWarning ? (
          <p className="rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-900 ring-1 ring-amber-200">
            Stai proponendo una struttura diversa da quella richiesta. Se è un&apos;alternativa, seleziona &quot;La struttura richiesta non è disponibile&quot;.
          </p>
        ) : null}

        <Section title="Cliente e soggiorno">
          <div className="grid gap-3 sm:grid-cols-2">
            <ClientSearch onSelect={(c) => { setFirstName(c.firstName); setLastName(c.lastName); setPhone(c.phone); setEmail(c.email); }} />
            <Input name="firstName" label="Nome cliente" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            <Input name="lastName" label="Cognome cliente" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            <Input name="phone" label="Telefono WhatsApp" required value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Input name="email" label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input
              name="checkIn"
              label="Data arrivo"
              required
              type="date"
              min={todayDateString()}
              value={checkIn}
              onChange={(e) => {
                const value = e.target.value;
                setCheckIn(value);
                if (checkOut && checkOut <= value) setCheckOut("");
              }}
            />
            <Input
              name="checkOut"
              label="Data partenza"
              required
              type="date"
              min={checkIn || tomorrowDateString()}
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
            />
            <Input name="adults" label="Adulti" min="1" required type="number" value={String(adultsCount)} onChange={(e) => setAdultsCount(Number(e.target.value) || 1)} />
            <Input label="Numero bambini" type="number" value={String(childrenCount)} onChange={(e) => setChildrenCount(Number(e.target.value))} min="0" />
            {Array.from({ length: childrenCount }, (_, index) => (
              <Input key={index} name={`child-${index}`} label={`Età bambino ${index + 1}`} required type="number" min="0" max="17" defaultValue={initialRequest?.children[index]?.age != null ? String(initialRequest.children[index].age) : ""} />
            ))}
            <Input name="rooms" label="Camere" min="1" required type="number" value={String(roomsCount)} onChange={(e) => setRoomsCount(Number(e.target.value) || 1)} />
            <Input name="hotelRequested" label="Hotel richiesto dal cliente" placeholder="Es. Hotel Terme Felix" defaultValue={initialRequest?.requestedHotel} />
          </div>
        </Section>

        <Section title={manualConfirmation ? "Struttura e trattamento confermati" : "Proposte hotel"}>
          <p className="text-sm text-ischia-ink/65">
            {manualConfirmation
              ? "Inserisci una sola struttura e assegna il prezzo a un solo trattamento: saranno riportati nel voucher."
              : "Inserisci fino a 3 strutture. Ogni struttura può avere uno o più trattamenti con prezzo. Solo i trattamenti con prezzo vengono mostrati al cliente."}
          </p>
          {requestedHotelName ? (
            <label className="flex gap-3 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-ischia-ink ring-1 ring-ischia-blue/10">
              <input checked={isAlternativeOffer} className="mt-1 h-4 w-4" onChange={(event) => setIsAlternativeOffer(event.target.checked)} type="checkbox" />
              La struttura richiesta non è disponibile
            </label>
          ) : null}
          <HotelOptionsEditor
            activeHotels={activeHotels}
            hotelOptions={hotelOptions}
            onChange={setHotelOptions}
            showDetectedPlus
            suggestedCapacity={roomCapacitySuggestion}
          />
        </Section>

        <Section title="Condizioni preventivo">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input name="validUntil" label={manualConfirmation ? "Data registrazione" : "Validità offerta"} required type="date" min={todayDateString()} defaultValue={manualConfirmation ? todayDateString() : undefined} />
          </div>
          <Textarea name="publicNotes" label="Note visibili al cliente" noteChips={PUBLIC_NOTE_CHIPS} />
          <Textarea name="internalNotes" label="Note interne" defaultValue={initialRequest?.message} />
        </Section>

        <button
          className="w-full rounded-full bg-ischia-sun px-5 py-3 font-black text-ischia-navy disabled:opacity-60 sm:w-auto"
          disabled={loading}
          type="submit"
        >
          {loading ? "Salvataggio..." : manualConfirmation ? "Crea prenotazione e prepara voucher" : "Genera preventivo"}
        </button>
      </form>

      <aside className="space-y-4">
        <div className="rounded-2xl bg-white/90 p-5 shadow-soft">
          <h2 className="text-xl font-black text-ischia-navy">{manualConfirmation ? "Importazione via email" : "Come funziona"}</h2>
          <ul className="mt-3 space-y-2 text-sm text-ischia-ink/70">
            {manualConfirmation ? (
              <>
                <li>Inserisci i dati ricevuti nella vecchia email.</li>
                <li>Indica una sola struttura e un solo trattamento con prezzo.</li>
                <li>Il sistema registra la prenotazione come già confermata.</li>
                <li>Dal dettaglio potrai registrare la caparra e inviare il voucher.</li>
              </>
            ) : (
              <>
                <li>Aggiungi fino a 3 strutture hotel.</li>
                <li>Per ogni struttura inserisci il prezzo dei trattamenti che vuoi proporre.</li>
                <li>Il cliente vede solo i trattamenti con prezzo e sceglie quello preferito.</li>
                <li>Se una struttura non ha prezzi, non viene mostrata.</li>
              </>
            )}
          </ul>
        </div>
      </aside>
    </div>
  );
}

function countPricedTreatments(hotelOptions: HotelOptionState[]) {
  return hotelOptions.reduce(
    (total, option) => total + option.roomTypes.reduce(
      (roomTotal, room) => roomTotal + [room.breakfastPrice, room.halfBoardPrice, room.fullBoardPrice].filter((price) => Number(price) > 0).length,
      0
    ),
    0
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

function Textarea({ label, value, onChange, onInput, noteChips, ...props }: { label: string; value?: string; onChange?: (value: string) => void; noteChips?: string[] } & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value">) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    resizeTextarea(ref.current);
  }, [value, props.defaultValue]);

  function appendNoteChip(note: string) {
    const textarea = ref.current;
    if (!textarea) return;
    const currentValue = value ?? textarea.value;
    if (currentValue.includes(note)) {
      textarea.focus();
      return;
    }
    const separator = currentValue.trim().length > 0 && !currentValue.endsWith("\n") ? "\n" : "";
    const nextValue = `${currentValue}${separator}${note}`;
    if (onChange) {
      onChange(nextValue);
    } else {
      textarea.value = nextValue;
    }
    window.requestAnimationFrame(() => {
      resizeTextarea(textarea);
      textarea.focus();
    });
  }

  return (
    <div className="block text-sm font-semibold text-ischia-ink">
      <label htmlFor={props.id ?? props.name}>{label}</label>
      {noteChips?.length ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {noteChips.map((note) => (
            <button
              className="rounded-full border border-ischia-blue/20 bg-ischia-mist px-3 py-1 text-xs font-bold text-ischia-navy transition hover:border-ischia-blue/40 hover:bg-white"
              key={note}
              type="button"
              onClick={() => appendNoteChip(note)}
            >
              {note}
            </button>
          ))}
        </div>
      ) : null}
      <textarea
        className="mt-1 min-h-24 w-full resize-y overflow-hidden whitespace-pre-wrap break-words rounded-xl border border-ischia-blue/20 px-3 py-2 leading-6"
        ref={ref}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        onInput={(event) => {
          resizeTextarea(event.currentTarget);
          onInput?.(event);
        }}
        wrap="soft"
        {...props}
      />
    </div>
  );
}

function resizeTextarea(element: HTMLTextAreaElement | null) {
  if (!element) return;
  element.style.height = "auto";
  element.style.height = `${Math.max(element.scrollHeight, 96)}px`;
}

export function findRequestedHotelInDb(requestedHotelName: string, hotels: Hotel[]): Hotel | undefined {
  const requested = normalizeHotelMatchName(requestedHotelName);
  if (!requested) return undefined;

  const exact = hotels.find((hotel) => normalizeHotelMatchName(hotel.name) === requested);
  if (exact) return exact;

  const slugExact = hotels.find((hotel) => hotel.slug && normalizeHotelMatchName(hotel.slug) === requested);
  if (slugExact) return slugExact;

  const requestedCore = normalizeHotelCoreName(requestedHotelName);
  const coreExact = hotels.find((hotel) => normalizeHotelCoreName(hotel.name) === requestedCore);
  if (coreExact) return coreExact;

  const containsMatches = hotels.filter((hotel) => {
    const hotelName = normalizeHotelMatchName(hotel.name);
    const hotelCore = normalizeHotelCoreName(hotel.name);
    return (
      requested.length >= 5 &&
      (hotelName.includes(requested) || requested.includes(hotelName) || hotelCore.includes(requestedCore) || requestedCore.includes(hotelCore))
    );
  });
  if (containsMatches.length === 1) return containsMatches[0];

  const requestedTokens = meaningfulHotelTokens(requestedHotelName);
  if (requestedTokens.length) {
    const tokenMatches = hotels.filter((hotel) => {
      const hotelTokens = meaningfulHotelTokens(hotel.name);
      return requestedTokens.some((token) => hotelTokens.includes(token));
    });
    if (tokenMatches.length === 1) return tokenMatches[0];
  }

  return undefined;
}

function normalizeHotelMatchName(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['â€™`]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeHotelCoreName(value: string) {
  return normalizeHotelMatchName(value)
    .split(" ")
    .filter((token) => !["hotel", "albergo", "terme", "spa", "resort", "club", "e"].includes(token))
    .join(" ")
    .trim();
}

function meaningfulHotelTokens(value: string) {
  return normalizeHotelCoreName(value)
    .split(" ")
    .filter((token) => token.length >= 5);
}
