"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { adminApiErrorMessage, adminApiFetch, adminApiHeaders, readAdminApiJson } from "@/lib/admin-api-client";
import { fillMissingHotelPolicies } from "@/lib/hotel-policies";
import { Hotel } from "@/lib/types";

type LrSyncItem = {
  externalId: string;
  name: string;
  action: "imported" | "updated" | "skipped";
  sourceUrl: string;
  hasImage: boolean;
  servicesCount: number;
  hasListino: boolean;
};

type LrSyncReport = {
  schemaVersion: string;
  generatedAt: string;
  cacheStatus: string | null;
  hotelsCount: number;
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
  warnings: string[];
  items: LrSyncItem[];
};

type HotelForm = {
  id?: string;
  name: string;
  location: string;
  stars: number;
  shortDescription: string;
  imageUrl: string;
  standardServices: string;
  defaultDepositPercent: string;
  defaultBalanceMethod: string;
  paymentPolicy: string;
  cancellationPolicy: string;
  defaultPaymentNotes: string;
  internalNotes: string;
  isActive: boolean;
  slug: string;
  sourceUrl: string;
};

const emptyForm: HotelForm = {
  name: "",
  location: "",
  stars: 4,
  shortDescription: "",
  imageUrl: "",
  standardServices: "",
  defaultDepositPercent: "",
  defaultBalanceMethod: "",
  paymentPolicy: "",
  cancellationPolicy: "",
  defaultPaymentNotes: "",
  internalNotes: "",
  isActive: true,
  slug: "",
  sourceUrl: ""
};

export function HotelManager({ initialHotels }: { initialHotels: Hotel[] }) {
  const router = useRouter();
  const [hotels, setHotels] = useState(initialHotels);
  const [form, setForm] = useState<HotelForm>(emptyForm);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [lrSyncLoading, setLrSyncLoading] = useState(false);
  const [lrSyncReport, setLrSyncReport] = useState<LrSyncReport | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const editing = Boolean(form.id);

  const sortedHotels = useMemo(() => [...hotels].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name)), [hotels]);

  async function saveHotel() {
    setLoading(true);
    setMessage(null);
    const payload = toPayload(form);
    const response = await adminApiFetch(form.id ? `/api/hotels/${form.id}` : "/api/hotels", {
      method: form.id ? "PATCH" : "POST",
      headers: adminApiHeaders(),
      body: JSON.stringify(payload)
    });
    const result = await readAdminApiJson<{ ok?: boolean; data?: Hotel; error?: string; source?: string }>(response);
    setLoading(false);
    if (!response.ok || !result?.ok || !result.data) {
      setMessage({ text: adminApiErrorMessage(response, result, "Salvataggio non riuscito."), ok: false });
      return;
    }
    if (result.source !== "supabase") {
      setMessage({ text: "Database non raggiunto: la modifica non è stata salvata sul server. Verifica la connessione.", ok: false });
      return;
    }
    setHotels((current) => (form.id ? current.map((hotel) => (hotel.id === result.data!.id ? result.data! : hotel)) : [result.data!, ...current]));
    setForm(fromHotel(result.data!));
    setMessage({ text: "Hotel salvato su database.", ok: true });
    router.refresh();
  }

  function prefillPolicyDefaults() {
    const policies = fillMissingHotelPolicies({
      hotelName: form.name,
      depositPercent: form.defaultDepositPercent ? Number(form.defaultDepositPercent) : undefined,
      balanceMethod: form.defaultBalanceMethod,
      paymentPolicy: form.paymentPolicy,
      cancellationPolicy: form.cancellationPolicy,
      paymentNotes: form.defaultPaymentNotes
    });
    setForm((prev) => ({
      ...prev,
      defaultDepositPercent: policies.depositPercent != null ? String(policies.depositPercent) : prev.defaultDepositPercent,
      defaultBalanceMethod: policies.balanceMethod || prev.defaultBalanceMethod,
      paymentPolicy: policies.paymentPolicy || prev.paymentPolicy,
      cancellationPolicy: policies.cancellationPolicy || prev.cancellationPolicy,
      defaultPaymentNotes: policies.paymentNotes || prev.defaultPaymentNotes
    }));
  }

  async function removeHotel(id: string) {
    const response = await adminApiFetch(`/api/hotels/${id}`, { method: "DELETE", headers: adminApiHeaders() });
    const result = await readAdminApiJson<{ ok?: boolean; error?: string; data?: { reason?: string } }>(response);
    if (!response.ok || !result?.ok) {
      setMessage({ text: result?.data?.reason ?? adminApiErrorMessage(response, result, "Hotel collegato a preventivi: disattivalo."), ok: false });
      return;
    }
    setHotels((current) => current.filter((hotel) => hotel.id !== id));
    setMessage({ text: "Hotel eliminato.", ok: true });
    router.refresh();
  }

  async function syncFromSite() {
    setSyncLoading(true);
    setMessage(null);
    const response = await adminApiFetch("/api/hotels/sync-from-site", {
      method: "POST",
      headers: adminApiHeaders()
    });
    const result = await readAdminApiJson<{ ok?: boolean; data?: { imported: number; updated: number; alreadyPresent: number; errors?: string[] }; error?: string }>(response);

    if (!response.ok || !result?.ok || !result.data) {
      setSyncLoading(false);
      setMessage({ text: adminApiErrorMessage(response, result, "Sincronizzazione non riuscita."), ok: false });
      return;
    }

    const refreshed = await adminApiFetch("/api/hotels", { headers: adminApiHeaders() });
    const refreshedResult = await readAdminApiJson<{ ok?: boolean; data?: Hotel[] }>(refreshed);
    if (refreshed.ok && refreshedResult?.data) setHotels(refreshedResult.data);

    const errors = result.data.errors?.length ? ` Errori: ${result.data.errors.length}.` : "";
    setMessage({ text: `${result.data.imported} hotel importati, ${result.data.updated} aggiornati, ${result.data.alreadyPresent} già presenti.${errors}`, ok: !errors });
    setSyncLoading(false);
    router.refresh();
  }

  async function syncFromLrFeed() {
    setLrSyncLoading(true);
    setLrSyncReport(null);
    setMessage(null);
    const response = await adminApiFetch("/api/hotels/sync-from-lr-feed", {
      method: "POST",
      headers: adminApiHeaders(),
    });
    const result = await readAdminApiJson<{ ok?: boolean; data?: LrSyncReport; error?: string }>(response);
    setLrSyncLoading(false);

    if (!response.ok || !result?.ok || !result.data) {
      setMessage({ text: adminApiErrorMessage(response, result, "Sincronizzazione LR Hotel non riuscita."), ok: false });
      return;
    }

    setLrSyncReport(result.data);

    const refreshed = await adminApiFetch("/api/hotels", { headers: adminApiHeaders() });
    const refreshedResult = await readAdminApiJson<{ ok?: boolean; data?: Hotel[] }>(refreshed);
    if (refreshed.ok && refreshedResult?.data) setHotels(refreshedResult.data);
    router.refresh();
  }

  async function importFromSite() {
    setImportLoading(true);
    setMessage(null);
    const response = await adminApiFetch(`/api/scrape-hotel?slug=${encodeURIComponent(form.slug.trim())}`, {
      headers: adminApiHeaders()
    });
    const result = await readAdminApiJson<{
      ok?: boolean;
      data?: { descrizione: string; serviziInclusi: string[] };
      error?: string;
    }>(response);
    setImportLoading(false);
    if (!response.ok || !result?.ok || !result.data) {
      setMessage({ text: adminApiErrorMessage(response, result, "Importazione non riuscita."), ok: false });
      return;
    }
    const { descrizione, serviziInclusi } = result.data;
    setForm((prev) => ({
      ...prev,
      shortDescription: descrizione || prev.shortDescription,
      standardServices: serviziInclusi.length ? serviziInclusi.join("\n") : prev.standardServices
    }));
    const parts = [descrizione ? "descrizione" : null, serviziInclusi.length ? `${serviziInclusi.length} servizi` : null].filter(Boolean);
    setMessage({ text: parts.length ? `Importati: ${parts.join(" e ")}.` : "Nessun dato trovato per questo slug.", ok: Boolean(parts.length) });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white/90 p-5 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-ischia-navy">{editing ? "Modifica hotel" : "Nuovo hotel"}</h2>
            <p className="mt-1 text-sm text-ischia-ink/68">Servizi: una riga per ogni servizio incluso.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="rounded-full bg-ischia-navy px-5 py-3 text-sm font-black text-white disabled:opacity-60" disabled={lrSyncLoading} onClick={() => void syncFromLrFeed()} type="button">
              {lrSyncLoading ? "Sincronizzazione..." : "Sincronizza da LR Hotel"}
            </button>
            <button className="rounded-full bg-ischia-blue/70 px-5 py-3 text-sm font-black text-white disabled:opacity-60" disabled={syncLoading} onClick={() => void syncFromSite()} type="button">
              {syncLoading ? "Sincronizzazione..." : "Sincronizza dal sito"}
            </button>
          </div>
        </div>
        {message ? (
          <p className={`mt-3 rounded-xl p-3 text-sm font-semibold ring-1 ${message.ok ? "bg-emerald-50 text-emerald-800 ring-emerald-100" : "bg-rose-50 text-rose-700 ring-rose-100"}`}>
            {message.text}
          </p>
        ) : null}
        {lrSyncReport ? (
          <div className="mt-3 rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-100">
            <p className="text-sm font-black text-emerald-800">
              Sincronizzazione LR Hotel completata - {lrSyncReport.imported} importati, {lrSyncReport.updated} aggiornati
              {lrSyncReport.errors.length > 0 ? `, ${lrSyncReport.errors.length} errori` : ""}
            </p>
            <p className="mt-1 text-xs text-emerald-700">
              Feed: {lrSyncReport.hotelsCount} hotel - generato {lrSyncReport.generatedAt}
              {lrSyncReport.cacheStatus ? ` - cache: ${lrSyncReport.cacheStatus}` : ""}
            </p>
            {lrSyncReport.items.length > 0 && (
              <div className="mt-3 space-y-1">
                {lrSyncReport.items.map((item) => (
                  <div key={item.externalId} className="flex flex-wrap items-center gap-2 text-xs text-emerald-900">
                    <span className={`rounded-full px-2 py-0.5 font-semibold ${item.action === "imported" ? "bg-emerald-200" : item.action === "updated" ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-600"}`}>
                      {item.action === "imported" ? "Nuovo" : item.action === "updated" ? "Aggiornato" : "Saltato"}
                    </span>
                    <span className="font-semibold">{item.name}</span>
                    {item.hasImage && <span className="text-emerald-600">Foto</span>}
                    {item.servicesCount > 0 && <span className="text-emerald-600">{item.servicesCount} servizi</span>}
                    {item.hasListino && <span className="text-emerald-600">Listino</span>}
                  </div>
                ))}
              </div>
            )}
            {lrSyncReport.errors.length > 0 && (
              <ul className="mt-2 space-y-1">
                {lrSyncReport.errors.map((e, i) => <li key={i} className="text-xs text-rose-700">{e}</li>)}
              </ul>
            )}
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-0">
            <Input
              label="URL o slug IschiaStars (per importare descrizione e servizi)"
              value={form.slug}
              onChange={(value) => setForm({ ...form, slug: value })}
            />
          </div>
          <button
            className="shrink-0 rounded-full bg-ischia-aqua px-5 py-3 text-sm font-black text-white disabled:opacity-60"
            disabled={importLoading || !form.slug.trim()}
            onClick={() => void importFromSite()}
            type="button"
          >
            {importLoading ? "Importazione..." : "Importa da IschiaStars"}
          </button>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <Input label="Nome hotel" value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
          <Input label="Località / zona" value={form.location} onChange={(value) => setForm({ ...form, location: value })} />
          <Input label="Stelle" type="number" value={String(form.stars)} onChange={(value) => setForm({ ...form, stars: Number(value) })} />
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <Textarea label="Descrizione breve" value={form.shortDescription} onChange={(value) => setForm({ ...form, shortDescription: value })} />
          <Textarea label="Immagine URL opzionale" value={form.imageUrl} onChange={(value) => setForm({ ...form, imageUrl: value })} />
          <Input label="URL pagina hotel su IschiaStars.it (visibile sul preventivo cliente)" value={form.sourceUrl} onChange={(value) => setForm({ ...form, sourceUrl: value })} />
          <Textarea label="Servizi inclusi standard" value={form.standardServices} onChange={(value) => setForm({ ...form, standardServices: value })} />
          <Input label="Acconto standard (%)" type="number" value={form.defaultDepositPercent} onChange={(value) => setForm({ ...form, defaultDepositPercent: value })} />
          <Textarea label="Modalità saldo standard" value={form.defaultBalanceMethod} onChange={(value) => setForm({ ...form, defaultBalanceMethod: value })} />
          <Textarea label="Policy pagamento standard" value={form.paymentPolicy} onChange={(value) => setForm({ ...form, paymentPolicy: value })} />
          <Textarea label="Policy cancellazione standard" value={form.cancellationPolicy} onChange={(value) => setForm({ ...form, cancellationPolicy: value })} />
          <Textarea label="Note pagamento standard" value={form.defaultPaymentNotes} onChange={(value) => setForm({ ...form, defaultPaymentNotes: value })} />
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
          <button className="rounded-full bg-white px-5 py-3 text-sm font-black text-ischia-navy ring-1 ring-ischia-blue/20" disabled={!form.name.trim()} onClick={prefillPolicyDefaults} type="button">
            Precompila condizioni
          </button>
          {editing ? <button className="rounded-full bg-white px-5 py-3 text-sm font-black text-ischia-navy ring-1 ring-ischia-blue/20" onClick={() => setForm(emptyForm)} type="button">Annulla</button> : null}
        </div>
      </section>

      {sortedHotels.length ? (
        <div className="grid gap-5 lg:grid-cols-3">
          {sortedHotels.map((hotel) => (
            <article key={hotel.id} className="overflow-hidden rounded-2xl bg-white/90 shadow-soft">
              {getHotelImageUrl(hotel) ? (
                <div className="relative h-44 w-full">
                  <Image className="object-cover" src={getHotelImageUrl(hotel)!} alt={hotel.name} fill sizes="(min-width: 1024px) 33vw, 100vw" />
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
              {hotel.externalImageUrl ? (
                <p className="mt-3 rounded-xl bg-ischia-mist px-3 py-2 text-xs font-bold text-ischia-navy">
                  Immagine da WordPress {hotel.imageUrl ? "disponibile, immagine manuale prioritaria" : "in uso"}
                </p>
              ) : null}
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
    const response = await adminApiFetch(`/api/hotels/${hotel.id}`, {
      method: "PATCH",
      headers: adminApiHeaders(),
      body: JSON.stringify(toPayload({ ...fromHotel(hotel), isActive: !hotel.active }))
    });
    const result = await readAdminApiJson<{ ok?: boolean; data?: Hotel }>(response);
    if (response.ok && result?.data) {
      setHotels((current) => current.map((item) => (item.id === hotel.id ? result.data! : item)));
      router.refresh();
    }
  }
}

function fromHotel(hotel: Hotel): HotelForm {
  const derivedSlug = hotel.slug ?? hotel.sourceUrl?.match(/\/hotel\/([^/?#]+)/i)?.[1] ?? "";
  return {
    id: hotel.id,
    name: hotel.name,
    location: hotel.zone,
    stars: hotel.stars,
    shortDescription: hotel.description,
    imageUrl: hotel.imageUrl ?? "",
    standardServices: hotel.standardServices.join("\n"),
    defaultDepositPercent: hotel.defaultDepositPercent != null ? String(hotel.defaultDepositPercent) : "",
    defaultBalanceMethod: hotel.defaultBalanceMethod ?? "",
    paymentPolicy: hotel.paymentPolicy,
    cancellationPolicy: hotel.cancellationPolicy,
    defaultPaymentNotes: hotel.defaultPaymentNotes ?? "",
    internalNotes: hotel.internalNotes,
    isActive: hotel.active,
    slug: derivedSlug,
    sourceUrl: hotel.sourceUrl ?? ""
  };
}

function toPayload(form: HotelForm) {
  return {
    name: form.name,
    location: form.location,
    stars: form.stars,
    shortDescription: form.shortDescription,
    imageUrl: form.imageUrl.trim() || null,
    standardServices: form.standardServices.split("\n").map((item) => item.trim()).filter(Boolean),
    defaultDepositPercent: form.defaultDepositPercent.trim() ? Number(form.defaultDepositPercent) : null,
    defaultBalanceMethod: form.defaultBalanceMethod,
    paymentPolicy: form.paymentPolicy,
    cancellationPolicy: form.cancellationPolicy,
    defaultPaymentNotes: form.defaultPaymentNotes,
    internalNotes: form.internalNotes,
    isActive: form.isActive,
    slug: form.slug.trim() || null,
    sourceUrl: form.sourceUrl.trim() || null
  };
}

function getHotelImageUrl(hotel: Hotel) {
  return hotel.imageUrl ?? hotel.externalImageUrl;
}

function Input({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="text-sm font-semibold text-ischia-ink">{label}<input className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2" type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function Textarea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="text-sm font-semibold text-ischia-ink">{label}<textarea className="mt-1 min-h-24 w-full rounded-xl border border-ischia-blue/20 px-3 py-2" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}
