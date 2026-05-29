"use client";

import Link from "next/link";
import type { FormEvent, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { useMemo, useState } from "react";
import { WhatsAppSendButton } from "@/components/WhatsAppSendButton";
import { adminApiHeaders } from "@/lib/admin-api-client";
import { Hotel, Quote, QuoteRequest } from "@/lib/types";
import { publicQuoteUrl } from "@/lib/utils";

type SavedQuote = Quote | null;
const treatmentOptions = ["Camera e Colazione", "Mezza Pensione", "Pensione Completa", "Solo Camera"];

export function NewQuoteForm({ hotels, initialRequest, requestedRequestId }: { hotels: Hotel[]; initialRequest?: QuoteRequest | null; requestedRequestId?: string }) {
  const activeHotels = hotels.filter((hotel) => hotel.active);
  const [hotelId, setHotelId] = useState(activeHotels[0]?.id ?? "");
  const [alternativeId, setAlternativeId] = useState(activeHotels[1]?.id ?? activeHotels[0]?.id ?? "");
  const [childrenCount, setChildrenCount] = useState(initialRequest?.children.length ?? 0);
  const [isAlternative, setIsAlternative] = useState(false);
  const [services, setServices] = useState(activeHotels[0]?.standardServices.join("\n") ?? "");
  const [paymentPolicy, setPaymentPolicy] = useState(activeHotels[0]?.paymentPolicy ?? "");
  const [cancellationPolicy, setCancellationPolicy] = useState(activeHotels[0]?.cancellationPolicy ?? "");
  const [savedQuote, setSavedQuote] = useState<SavedQuote>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedHotel = useMemo(() => activeHotels.find((hotel) => hotel.id === hotelId), [activeHotels, hotelId]);

  function handleHotelChange(id: string) {
    setHotelId(id);
    const hotel = activeHotels.find((item) => item.id === id);
    if (!hotel) return;
    setServices(hotel.standardServices.join("\n"));
    setPaymentPolicy(hotel.paymentPolicy);
    setCancellationPolicy(hotel.cancellationPolicy);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(event.currentTarget);
    const children = Array.from({ length: childrenCount }, (_, index) => ({ birthDate: String(formData.get(`child-${index}`) ?? "") }));
    if (children.some((child) => !child.birthDate)) {
      setError("Inserisci la data di nascita per ogni bambino.");
      setLoading(false);
      return;
    }

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
        treatment: formData.get("treatment"),
        quoteRequestId: initialRequest?.id,
        hotelRequested: formData.get("hotelRequested"),
        hotelId,
        alternativeHotelId: isAlternative ? alternativeId : undefined,
        isAlternativeOffer: isAlternative,
        totalPrice: Number(formData.get("totalPrice") ?? 0),
        depositAmount: Number(formData.get("depositAmount") ?? 0),
        validUntil: formData.get("validUntil"),
        includedServices: services.split("\n").map((item) => item.trim()).filter(Boolean),
        transportOffers: [],
        paymentPolicy,
        cancellationPolicy,
        publicNotes: formData.get("publicNotes"),
        internalNotes: formData.get("internalNotes")
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
            <Input label="Numero bambini" type="number" value={String(childrenCount)} onChange={(event) => setChildrenCount(Number(event.target.value))} min="0" />
            {Array.from({ length: childrenCount }, (_, index) => <Input key={index} name={`child-${index}`} label={`Data nascita bambino ${index + 1}`} required type="date" defaultValue={initialRequest?.children[index]?.birthDate} />)}
            <Input name="rooms" label="Camere" required type="number" defaultValue={String(initialRequest?.rooms ?? 1)} />
            <TreatmentSelect name="treatment" label="Trattamento" defaultValue={normalizeTreatment(initialRequest?.requestedTreatment)} />
          </div>
        </Section>

        <Section title="Hotel e alternativa">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input name="hotelRequested" label="Hotel richiesto" placeholder="Hotel chiesto dal cliente" defaultValue={initialRequest?.requestedHotel} />
            <label className="text-sm font-semibold text-ischia-ink">Hotel proposto<select className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2" value={hotelId} onChange={(event) => handleHotelChange(event.target.value)}>{activeHotels.map((hotel) => <option key={hotel.id} value={hotel.id}>{hotel.name}</option>)}</select></label>
          </div>
          <label className="mt-3 flex items-center gap-3 text-sm font-semibold"><input checked={isAlternative} onChange={(event) => setIsAlternative(event.target.checked)} type="checkbox" /> La struttura richiesta non è disponibile</label>
          {isAlternative ? (
            <div className="mt-3">
              <label className="text-sm font-semibold text-ischia-ink">Struttura alternativa proposta<select className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2" value={alternativeId} onChange={(event) => setAlternativeId(event.target.value)}>{activeHotels.map((hotel) => <option key={hotel.id} value={hotel.id}>{hotel.name}</option>)}</select></label>
            </div>
          ) : null}
        </Section>

        <Section title="Prezzo e condizioni">
          <div className="grid gap-3 sm:grid-cols-3">
            <Input name="totalPrice" label="Prezzo totale" required type="number" />
            <Input name="depositAmount" label="Acconto richiesto" required type="number" />
            <Input name="validUntil" label="Validita offerta" required type="date" />
          </div>
          <Textarea label="Servizi inclusi" value={services} onChange={setServices} />
          <Textarea label="Policy pagamento" value={paymentPolicy} onChange={setPaymentPolicy} />
          <Textarea label="Policy cancellazione" value={cancellationPolicy} onChange={setCancellationPolicy} />
          <Textarea name="publicNotes" label="Note visibili al cliente" defaultValue={isAlternative ? "La struttura richiesta non è disponibile per le date selezionate. Abbiamo selezionato per te una proposta alternativa con caratteristiche simili." : selectedHotel?.description ?? ""} />
          <Textarea name="internalNotes" label="Note interne" defaultValue={initialRequest?.message} />
        </Section>

        <button className="w-full rounded-full bg-ischia-sun px-5 py-3 font-black text-ischia-navy disabled:opacity-60 sm:w-auto" disabled={loading} type="submit">{loading ? "Creo il preventivo..." : "Genera preventivo"}</button>
      </form>

      <aside className="space-y-4">
        <div className="rounded-2xl bg-white/90 p-5 shadow-soft">
          <h2 className="text-xl font-black text-ischia-navy">Risultato</h2>
          <p className="mt-2 text-sm text-ischia-ink/70">Dopo il salvataggio vedrai link pubblico e invio WhatsApp.</p>
        </div>
      </aside>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rounded-2xl bg-white/90 p-5 shadow-soft"><h2 className="text-xl font-black text-ischia-navy">{title}</h2><div className="mt-4 space-y-3">{children}</div></section>;
}

function Input({ label, ...props }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return <label className="text-sm font-semibold text-ischia-ink">{label}<input className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2" {...props} /></label>;
}

function TreatmentSelect({ label, ...props }: { label: string } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="text-sm font-semibold text-ischia-ink">
      {label}
      <select className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2" {...props}>
        {treatmentOptions.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function Textarea({ label, value, onChange, ...props }: { label: string; value?: string; onChange?: (value: string) => void } & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value">) {
  return <label className="block text-sm font-semibold text-ischia-ink">{label}<textarea className="mt-1 min-h-28 w-full rounded-xl border border-ischia-blue/20 px-3 py-2" value={value} onChange={onChange ? (event) => onChange(event.target.value) : undefined} {...props} /></label>;
}

function normalizeTreatment(value?: string) {
  if (!value) return "Camera e Colazione";
  const normalized = value.trim().toLowerCase();
  if (["prima colazione", "bb", "b&b", "bed and breakfast", "camera e colazione"].includes(normalized)) return "Camera e Colazione";
  if (["mezza pensione", "half board"].includes(normalized)) return "Mezza Pensione";
  if (["pensione completa", "full board"].includes(normalized)) return "Pensione Completa";
  if (["solo camera", "room only"].includes(normalized)) return "Solo Camera";
  return treatmentOptions.find((option) => option.toLowerCase() === normalized) ?? "Camera e Colazione";
}
