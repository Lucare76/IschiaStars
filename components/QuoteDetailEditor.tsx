"use client";

import Link from "next/link";
import type { FormEvent, InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { useState } from "react";
import { QuoteStatusBadge } from "@/components/QuoteStatusBadge";
import { WhatsAppSendButton } from "@/components/WhatsAppSendButton";
import { adminApiHeaders } from "@/lib/admin-api-client";
import { Hotel, Quote, QuoteStatus, TransportOffer } from "@/lib/types";
import { formatCurrency, publicQuoteUrl } from "@/lib/utils";

const statusOptions: QuoteStatus[] = ["preventivo_inviato", "confermato", "perso_non_disponibile"];

export function QuoteDetailEditor({ quote, hotels }: { quote: Quote; hotels: Hotel[] }) {
  const [currentQuote, setCurrentQuote] = useState(quote);
  const [hotelId, setHotelId] = useState(quote.proposedHotel.id);
  const [alternativeId, setAlternativeId] = useState(quote.alternativeHotel?.id ?? quote.proposedHotel.id);
  const [isAlternative, setIsAlternative] = useState(quote.isAlternative);
  const [services, setServices] = useState(quote.servicesIncluded.join("\n"));
  const [paymentPolicy, setPaymentPolicy] = useState(quote.paymentPolicy);
  const [cancellationPolicy, setCancellationPolicy] = useState(quote.cancellationPolicy);
  const [transportOffers] = useState<TransportOffer[]>(withDefaultTransportOffers(quote.transportOffers));
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    const formData = new FormData(event.currentTarget);
    const payload = {
      clientFirstName: formData.get("firstName"),
      clientLastName: formData.get("lastName"),
      clientEmail: formData.get("email"),
      clientPhone: formData.get("phone"),
      hotelRequested: formData.get("hotelRequested"),
      hotelId,
      alternativeHotelId: isAlternative ? alternativeId : undefined,
      isAlternativeOffer: isAlternative,
      checkIn: formData.get("checkIn"),
      checkOut: formData.get("checkOut"),
      adults: Number(formData.get("adults") ?? 2),
      rooms: Number(formData.get("rooms") ?? 1),
      treatment: formData.get("treatment"),
      totalPrice: Number(formData.get("totalPrice") ?? 0),
      depositAmount: Number(formData.get("depositAmount") ?? 0),
      validUntil: formData.get("validUntil"),
      includedServices: services.split("\n").map((item) => item.trim()).filter(Boolean),
      transportOffers,
      paymentPolicy,
      cancellationPolicy,
      publicNotes: formData.get("publicNotes"),
      internalNotes: formData.get("internalNotes")
    };

    const response = await fetch(`/api/quotes/${currentQuote.id}`, {
      method: "PATCH",
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
      headers: adminApiHeaders(),
      body: JSON.stringify({ statusOnly: true, status })
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; data?: Quote } | null;
    if (response.ok && result?.data) setCurrentQuote(result.data);
  }

  async function duplicateCurrentQuote() {
    setMessage(null);
    const response = await fetch(`/api/quotes/${currentQuote.id}`, {
      method: "POST",
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
            <Input name="treatment" label="Trattamento" defaultValue={currentQuote.treatment} />
          </div>
        </Section>

        <Section title="Hotel e alternativa">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input name="hotelRequested" label="Hotel richiesto" defaultValue={currentQuote.requestedHotel} />
            <label className="text-sm font-semibold text-ischia-ink">Hotel proposto<select className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2" value={hotelId} onChange={(event) => setHotelId(event.target.value)}>{hotels.map((hotel) => <option key={hotel.id} value={hotel.id}>{hotel.name}</option>)}</select></label>
          </div>
          <label className="mt-3 flex items-center gap-3 text-sm font-semibold"><input checked={isAlternative} onChange={(event) => setIsAlternative(event.target.checked)} type="checkbox" /> Struttura richiesta non disponibile</label>
          {isAlternative ? <label className="mt-3 block text-sm font-semibold text-ischia-ink">Alternativa proposta<select className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2" value={alternativeId} onChange={(event) => setAlternativeId(event.target.value)}>{hotels.map((hotel) => <option key={hotel.id} value={hotel.id}>{hotel.name}</option>)}</select></label> : null}
        </Section>

        <Section title="Prezzi, condizioni e note">
          <div className="grid gap-3 sm:grid-cols-3">
            <Input name="totalPrice" label="Prezzo totale" defaultValue={String(currentQuote.totalPrice)} required type="number" />
            <Input name="depositAmount" label="Acconto" defaultValue={String(currentQuote.deposit)} required type="number" />
            <Input name="validUntil" label="Scadenza offerta" defaultValue={currentQuote.offerExpiresAt} required type="date" />
          </div>
          <Textarea label="Servizi inclusi" value={services} onChange={setServices} />
          <Textarea label="Policy pagamento" value={paymentPolicy} onChange={setPaymentPolicy} />
          <Textarea label="Policy cancellazione" value={cancellationPolicy} onChange={setCancellationPolicy} />
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
          <p className="mt-4 text-sm text-ischia-ink/70">Totale attuale</p>
          <p className="text-3xl font-black text-ischia-navy">{formatCurrency(currentQuote.totalPrice)}</p>
          <div className="mt-5 grid gap-2">
            <Link className="rounded-full bg-ischia-navy px-4 py-2 text-center text-sm font-black text-white" href={publicQuoteUrl(currentQuote)}>Apri link cliente</Link>
            <WhatsAppSendButton quote={currentQuote} />
            <button className="rounded-full bg-ischia-sun px-4 py-2 text-sm font-black text-ischia-navy" onClick={() => void duplicateCurrentQuote()} type="button">
              Duplica preventivo
            </button>
          </div>
          <p className="mt-4 break-all text-xs text-ischia-ink/60">{publicQuoteUrl(currentQuote)}</p>
        </div>

        <div className="rounded-2xl bg-white/90 p-5 shadow-soft">
          <h3 className="font-black text-ischia-navy">Cambia stato</h3>
          <div className="mt-3 grid gap-2">
            {statusOptions.map((status) => <button key={status} className="rounded-full bg-white px-4 py-2 text-sm font-black text-ischia-navy ring-1 ring-ischia-blue/20" onClick={() => void changeStatus(status)} type="button">{statusLabel(status)}</button>)}
          </div>
        </div>
      </aside>
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
  return <label className="block text-sm font-semibold text-ischia-ink">{label}<textarea className="mt-1 min-h-24 w-full rounded-xl border border-ischia-blue/20 px-3 py-2" value={value} onChange={onChange ? (event) => onChange(event.target.value) : undefined} {...props} /></label>;
}

function withDefaultTransportOffers(offers: TransportOffer[] = []) {
  const byType = new Map(offers.map((offer) => [offer.type, offer]));
  return (["train", "ferry", "hydrofoil"] as const).map((type) => byType.get(type) ?? defaultTransportOffer(type));
}

function defaultTransportOffer(type: "train" | "ferry" | "hydrofoil"): TransportOffer {
  if (type === "train") return { id: "default-train", type, title: "Treno fino a Napoli Centrale", description: "Combinazione treno + porto per raggiungere Ischia.", notes: "Prezzo su richiesta." };
  if (type === "hydrofoil") return { id: "default-hydrofoil", type, title: "Aliscafo per Ischia", description: "Collegamento veloce da Napoli Beverello.", notes: "Orari e tariffe da riconfermare." };
  return { id: "default-ferry", type, title: "Traghetto per Ischia", description: "Soluzione comoda da Napoli o Pozzuoli.", notes: "Prezzo su richiesta." };
}

function statusLabel(status: QuoteStatus) {
  if (status === "preventivo_inviato") return "Preventivo inviato";
  if (status === "confermato") return "Confermato";
  if (status === "perso_non_disponibile") return "Perso / non disponibile";
  if (status === "in_lavorazione") return "In lavorazione";
  return "Da evadere";
}
