"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { adminApiHeaders } from "@/lib/admin-api-client";
import { Hotel } from "@/lib/types";

type HotelForm = {
  id?: string;
  name: string;
  location: string;
  stars: number;
  shortDescription: string;
  imageUrl: string;
  standardServices: string;
  paymentPolicy: string;
  cancellationPolicy: string;
  internalNotes: string;
  isActive: boolean;
};

const emptyForm: HotelForm = {
  name: "",
  location: "",
  stars: 4,
  shortDescription: "",
  imageUrl: "",
  standardServices: "",
  paymentPolicy: "",
  cancellationPolicy: "",
  internalNotes: "",
  isActive: true
};

export function HotelManager({ initialHotels }: { initialHotels: Hotel[] }) {
  const [hotels, setHotels] = useState(initialHotels);
  const [form, setForm] = useState<HotelForm>(emptyForm);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const editing = Boolean(form.id);

  const sortedHotels = useMemo(() => [...hotels].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name)), [hotels]);

  async function saveHotel() {
    setLoading(true);
    setMessage(null);
    const payload = toPayload(form);
    const response = await fetch(form.id ? `/api/hotels/${form.id}` : "/api/hotels", {
      method: form.id ? "PATCH" : "POST",
      headers: adminApiHeaders(),
      body: JSON.stringify(payload)
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; data?: Hotel; error?: string; source?: string } | null;
    setLoading(false);
    if (!response.ok || !result?.ok || !result.data) {
      setMessage(result?.error ?? "Salvataggio non riuscito");
      return;
    }
    setHotels((current) => (form.id ? current.map((hotel) => (hotel.id === result.data!.id ? result.data! : hotel)) : [result.data!, ...current]));
    setForm(emptyForm);
    setMessage("Hotel salvato.");
  }

  async function removeHotel(id: string) {
    const response = await fetch(`/api/hotels/${id}`, { method: "DELETE", headers: adminApiHeaders() });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; data?: { reason?: string } } | null;
    if (!response.ok || !result?.ok) {
      setMessage(result?.error ?? result?.data?.reason ?? "Hotel collegato a preventivi: disattivalo.");
      return;
    }
    setHotels((current) => current.filter((hotel) => hotel.id !== id));
    setMessage("Hotel eliminato.");
  }

  async function syncFromSite() {
    setSyncLoading(true);
    setMessage(null);
    const response = await fetch("/api/hotels/sync-from-site", {
      method: "POST",
      headers: adminApiHeaders()
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; data?: { imported: number; updated: number; alreadyPresent: number; errors?: string[] }; error?: string } | null;

    if (!response.ok || !result?.ok || !result.data) {
      setSyncLoading(false);
      setMessage(result?.error ?? "Sincronizzazione non riuscita");
      return;
    }

    const refreshed = await fetch("/api/hotels", { headers: adminApiHeaders() });
    const refreshedResult = (await refreshed.json().catch(() => null)) as { ok?: boolean; data?: Hotel[] } | null;
    if (refreshed.ok && refreshedResult?.data) setHotels(refreshedResult.data);

    const errors = result.data.errors?.length ? ` Errori: ${result.data.errors.length}.` : "";
    setMessage(`${result.data.imported} hotel importati, ${result.data.updated} aggiornati, ${result.data.alreadyPresent} già presenti.${errors}`);
    setSyncLoading(false);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white/90 p-5 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-ischia-navy">{editing ? "Modifica hotel" : "Nuovo hotel"}</h2>
            <p className="mt-1 text-sm text-ischia-ink/68">Servizi: una riga per ogni servizio incluso.</p>
          </div>
          <button className="rounded-full bg-ischia-blue px-5 py-3 text-sm font-black text-white disabled:opacity-60" disabled={syncLoading} onClick={() => void syncFromSite()} type="button">
            {syncLoading ? "Sincronizzazione..." : "Sincronizza hotel dal sito"}
          </button>
        </div>
        {message ? <p className="mt-3 rounded-xl bg-ischia-mist p-3 text-sm font-semibold text-ischia-navy">{message}</p> : null}
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <Input label="Nome hotel" value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
          <Input label="Localita / zona" value={form.location} onChange={(value) => setForm({ ...form, location: value })} />
          <Input label="Stelle" type="number" value={String(form.stars)} onChange={(value) => setForm({ ...form, stars: Number(value) })} />
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <Textarea label="Descrizione breve" value={form.shortDescription} onChange={(value) => setForm({ ...form, shortDescription: value })} />
          <Textarea label="Immagine URL opzionale" value={form.imageUrl} onChange={(value) => setForm({ ...form, imageUrl: value })} />
          <Textarea label="Servizi inclusi standard" value={form.standardServices} onChange={(value) => setForm({ ...form, standardServices: value })} />
          <Textarea label="Policy pagamento standard" value={form.paymentPolicy} onChange={(value) => setForm({ ...form, paymentPolicy: value })} />
          <Textarea label="Policy cancellazione standard" value={form.cancellationPolicy} onChange={(value) => setForm({ ...form, cancellationPolicy: value })} />
          <Textarea label="Note operative interne" value={form.internalNotes} onChange={(value) => setForm({ ...form, internalNotes: value })} />
        </div>
        <label className="mt-4 flex items-center gap-3 text-sm font-semibold">
          <input checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} type="checkbox" />
          Hotel attivo
        </label>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="rounded-full bg-ischia-navy px-5 py-3 text-sm font-black text-white disabled:opacity-60" disabled={loading || !form.name || !form.location} onClick={saveHotel} type="button">
            {loading ? "Salvataggio..." : editing ? "Salva modifiche" : "Crea hotel"}
          </button>
          {editing ? <button className="rounded-full bg-white px-5 py-3 text-sm font-black text-ischia-navy ring-1 ring-ischia-blue/20" onClick={() => setForm(emptyForm)} type="button">Annulla</button> : null}
        </div>
      </section>

      {sortedHotels.length ? (
        <div className="grid gap-5 lg:grid-cols-3">
          {sortedHotels.map((hotel) => (
            <article key={hotel.id} className="overflow-hidden rounded-2xl bg-white/90 shadow-soft">
              {hotel.imageUrl ? (
                <div className="relative h-44 w-full">
                  <Image className="object-cover" src={hotel.imageUrl} alt={hotel.name} fill sizes="(min-width: 1024px) 33vw, 100vw" />
                </div>
              ) : (
                <div className="flex h-44 items-center justify-center bg-ischia-mist px-5 text-center text-sm font-bold text-ischia-ink/55">Nessuna foto impostata</div>
              )}
              <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-ischia-blue">{hotel.zone} - {hotel.stars} stelle</p>
                  <h2 className="mt-1 text-2xl font-black text-ischia-navy">{hotel.name}</h2>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-black ${hotel.active ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{hotel.active ? "Attivo" : "Non attivo"}</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-ischia-ink/72">{hotel.description}</p>
              <ul className="mt-4 grid gap-2 text-sm">
                {hotel.standardServices.map((service) => <li className="rounded-xl bg-ischia-mist p-2" key={service}>{service}</li>)}
              </ul>
              <div className="mt-5 flex flex-wrap gap-2">
                <button className="rounded-full bg-ischia-sun px-4 py-2 text-sm font-black text-ischia-navy" onClick={() => setForm(fromHotel(hotel))} type="button">Modifica</button>
                {hotel.sourceUrl ? <a className="rounded-full bg-white px-4 py-2 text-sm font-black text-ischia-navy ring-1 ring-ischia-blue/20" href={hotel.sourceUrl} target="_blank" rel="noreferrer">Scheda sito</a> : null}
                <button className="rounded-full bg-white px-4 py-2 text-sm font-black text-ischia-navy ring-1 ring-ischia-blue/20" onClick={() => void toggleActive(hotel)} type="button">{hotel.active ? "Disattiva" : "Riattiva"}</button>
                <button className="rounded-full bg-rose-50 px-4 py-2 text-sm font-black text-rose-700 ring-1 ring-rose-100" onClick={() => void removeHotel(hotel.id)} type="button">Elimina</button>
              </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl bg-white/90 p-6 shadow-soft">
          <p className="text-sm font-semibold text-ischia-ink/65">Nessuna struttura presente. Puoi aggiungere un hotel manualmente oppure sincronizzare le strutture dal sito IschiaStars.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="rounded-full bg-ischia-sun px-4 py-2 text-sm font-black text-ischia-navy" onClick={() => setForm(emptyForm)} type="button">Aggiungi hotel</button>
            <button className="rounded-full bg-ischia-blue px-4 py-2 text-sm font-black text-white disabled:opacity-60" disabled={syncLoading} onClick={() => void syncFromSite()} type="button">
              {syncLoading ? "Sincronizzazione..." : "Sincronizza dal sito"}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  async function toggleActive(hotel: Hotel) {
    const response = await fetch(`/api/hotels/${hotel.id}`, {
      method: "PATCH",
      headers: adminApiHeaders(),
      body: JSON.stringify(toPayload({ ...fromHotel(hotel), isActive: !hotel.active }))
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; data?: Hotel } | null;
    if (response.ok && result?.data) setHotels((current) => current.map((item) => (item.id === hotel.id ? result.data! : item)));
  }
}

function fromHotel(hotel: Hotel): HotelForm {
  return {
    id: hotel.id,
    name: hotel.name,
    location: hotel.zone,
    stars: hotel.stars,
    shortDescription: hotel.description,
    imageUrl: hotel.imageUrl ?? "",
    standardServices: hotel.standardServices.join("\n"),
    paymentPolicy: hotel.paymentPolicy,
    cancellationPolicy: hotel.cancellationPolicy,
    internalNotes: hotel.internalNotes,
    isActive: hotel.active
  };
}

function toPayload(form: HotelForm) {
  return {
    name: form.name,
    location: form.location,
    stars: form.stars,
    shortDescription: form.shortDescription,
    imageUrl: form.imageUrl || undefined,
    standardServices: form.standardServices.split("\n").map((item) => item.trim()).filter(Boolean),
    paymentPolicy: form.paymentPolicy,
    cancellationPolicy: form.cancellationPolicy,
    internalNotes: form.internalNotes,
    isActive: form.isActive
  };
}

function Input({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="text-sm font-semibold text-ischia-ink">{label}<input className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2" type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function Textarea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="text-sm font-semibold text-ischia-ink">{label}<textarea className="mt-1 min-h-24 w-full rounded-xl border border-ischia-blue/20 px-3 py-2" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}
