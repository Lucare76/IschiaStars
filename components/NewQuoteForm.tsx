"use client";

import Link from "next/link";
import type { FormEvent, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { useState } from "react";
import {
  createHotelOption,
  HotelOptionState,
  HotelOptionsEditor,
  hotelOptionHasPrice,
  mapHotelOptionsToPayload,
  suggestedGuestsPerRoom
} from "@/components/HotelOptionsEditor";
import { WhatsAppSendButton } from "@/components/WhatsAppSendButton";
import { adminApiErrorMessage, adminApiFetch, readAdminApiJson } from "@/lib/admin-api-client";
import { Hotel, Quote, QuoteRequest } from "@/lib/types";
import { publicQuoteUrl } from "@/lib/utils";

type SavedQuote = Quote | null;
type EmailStatus = { sent: boolean; skipReason?: string } | null;

export function NewQuoteForm({ hotels, initialRequest, requestedRequestId }: { hotels: Hotel[]; initialRequest?: QuoteRequest | null; requestedRequestId?: string }) {
  const activeHotels = hotels.filter((h) => h.active);
  const requestedHotelName = initialRequest?.requestedHotel?.trim() ?? "";
  const requestedHotelMatch = requestedHotelName ? findRequestedHotelInDb(requestedHotelName, activeHotels) : undefined;
  const [childrenCount, setChildrenCount] = useState(initialRequest?.children.length ?? 0);
  const [adultsCount, setAdultsCount] = useState(initialRequest?.adults ?? 2);
  const [roomsCount, setRoomsCount] = useState(initialRequest?.rooms ?? 1);
  const [savedQuote, setSavedQuote] = useState<SavedQuote>(null);
  const [emailStatus, setEmailStatus] = useState<EmailStatus>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isAlternativeOffer, setIsAlternativeOffer] = useState(false);
  const [hotelOptions, setHotelOptions] = useState<HotelOptionState[]>([createHotelOption(requestedHotelMatch)]);
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

    const hasAtLeastOnePrice = hotelOptions.some(hotelOptionHasPrice);
    if (!hasAtLeastOnePrice) {
      setError("Inserisci almeno un prezzo in almeno una struttura per generare il preventivo.");
      setLoading(false);
      return;
    }

    const formData = new FormData(event.currentTarget);
    const children = Array.from({ length: childrenCount }, (_, index) => ({ age: Number(formData.get(`child-${index}`) ?? "") }));
    if (children.some((c) => isNaN(c.age) || c.age < 0 || c.age > 17)) {
      setError("Inserisci l'etÃ  (0â€“17 anni) per ogni bambino.");
      setLoading(false);
      return;
    }

    const mappedOptions = mapHotelOptionsToPayload(hotelOptions);

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
        hotelOptions: mappedOptions
      })
    });
    const result = await readAdminApiJson<{ ok?: boolean; data?: Quote; error?: string; emailSent?: boolean; emailSkipReason?: string }>(response);
    setLoading(false);
    if (!response.ok || !result?.ok || !result.data) {
      setError(adminApiErrorMessage(response, result, `Preventivo non salvato (${response.status}). Riprova o verifica la sessione operatore.`));
      return;
    }
    setEmailStatus({ sent: result.emailSent ?? false, skipReason: result.emailSkipReason });
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
        {emailStatus !== null && (
          emailStatus.sent
            ? <p className="mt-3 rounded-xl bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800">Email inviata al cliente.</p>
            : <p className="mt-3 rounded-xl bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800">
                Email cliente NON inviata ({emailStatus.skipReason ?? "motivo sconosciuto"}). Usa il link WhatsApp per condividere il preventivo.
              </p>
        )}
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
            <Link className="rounded-full bg-ischia-navy px-4 py-2 font-black text-white" href={publicQuoteUrl(savedQuote)} rel="noopener noreferrer" target="_blank">
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
        {requestedHotelMissing ? (
          <p className="rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-900 ring-1 ring-amber-200">
            Hotel richiesto non trovato nel database. Seleziona manualmente la struttura da proporre.
          </p>
        ) : null}
        {showAlternativeWarning ? (
          <p className="rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-900 ring-1 ring-amber-200">
            Stai proponendo una struttura diversa da quella richiesta. Se Ã¨ un&apos;alternativa, seleziona &quot;La struttura richiesta non Ã¨ disponibile&quot;.
          </p>
        ) : null}

        <Section title="Cliente e soggiorno">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input name="firstName" label="Nome cliente" required defaultValue={initialRequest?.firstName} />
            <Input name="lastName" label="Cognome cliente" required defaultValue={initialRequest?.lastName} />
            <Input name="phone" label="Telefono WhatsApp" required defaultValue={initialRequest?.phone} />
            <Input name="email" label="Email" required type="email" defaultValue={initialRequest?.email} />
            <Input name="checkIn" label="Data arrivo" required type="date" defaultValue={initialRequest?.arrivalDate} />
            <Input name="checkOut" label="Data partenza" required type="date" defaultValue={initialRequest?.departureDate} />
            <Input name="adults" label="Adulti" min="1" required type="number" value={String(adultsCount)} onChange={(e) => setAdultsCount(Number(e.target.value) || 1)} />
            <Input label="Numero bambini" type="number" value={String(childrenCount)} onChange={(e) => setChildrenCount(Number(e.target.value))} min="0" />
            {Array.from({ length: childrenCount }, (_, index) => (
              <Input key={index} name={`child-${index}`} label={`EtÃ  bambino ${index + 1}`} required type="number" min="0" max="17" defaultValue={initialRequest?.children[index]?.age != null ? String(initialRequest.children[index].age) : ""} />
            ))}
            <Input name="rooms" label="Camere" min="1" required type="number" value={String(roomsCount)} onChange={(e) => setRoomsCount(Number(e.target.value) || 1)} />
            <Input name="hotelRequested" label="Hotel richiesto dal cliente" placeholder="Es. Hotel Terme Felix" defaultValue={initialRequest?.requestedHotel} />
          </div>
        </Section>

        <Section title="Proposte hotel">
          <p className="text-sm text-ischia-ink/65">Inserisci fino a 3 strutture. Ogni struttura puÃ² avere uno o piÃ¹ trattamenti con prezzo. Solo i trattamenti con prezzo vengono mostrati al cliente.</p>
          {requestedHotelName ? (
            <label className="flex gap-3 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-ischia-ink ring-1 ring-ischia-blue/10">
              <input checked={isAlternativeOffer} className="mt-1 h-4 w-4" onChange={(event) => setIsAlternativeOffer(event.target.checked)} type="checkbox" />
              La struttura richiesta non Ã¨ disponibile
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
