"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminApiErrorMessage, adminApiFetch, readAdminApiJson } from "@/lib/admin-api-client";
import { ExtraServiceEmailItem } from "@/lib/extra-service-email-items";

export function ExtraServiceEmailItemsEditor({ initialItems }: { initialItems: ExtraServiceEmailItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function updateItem(id: string, patch: Partial<ExtraServiceEmailItem>) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  function addItem() {
    const nextOrder = items.reduce((highest, item) => Math.max(highest, item.sortOrder), 0) + 1;
    setItems((current) => [...current, {
      id: crypto.randomUUID(),
      title: "",
      description: "",
      priceFrom: 0,
      priceSuffix: "a persona",
      isActive: true,
      sortOrder: nextOrder
    }]);
  }

  async function save() {
    setLoading(true);
    setMessage(null);
    const response = await adminApiFetch("/api/extra-service-email-items", {
      method: "PATCH",
      body: JSON.stringify({ items })
    });
    const result = await readAdminApiJson<{ ok?: boolean; data?: ExtraServiceEmailItem[]; error?: string }>(response);
    setLoading(false);

    if (!response.ok || !result?.ok || !result.data) {
      setMessage(adminApiErrorMessage(response, result, "Salvataggio non riuscito."));
      return;
    }

    setItems(result.data);
    setMessage("Voci servizi extra salvate.");
    router.refresh();
  }

  return (
    <section className="rounded-2xl bg-white/90 p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-ischia-navy">Collegamenti mostrati nelle email</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-ischia-ink/65">
            Modifica prezzi e testi commerciali. Le voci disattivate non compaiono nelle email preventivo.
          </p>
        </div>
        <button type="button" onClick={addItem} className="rounded-full bg-ischia-mist px-4 py-2 text-sm font-black text-ischia-navy ring-1 ring-ischia-blue/15">
          + Aggiungi voce
        </button>
      </div>

      {message ? <p className="mt-4 rounded-xl bg-ischia-mist p-3 text-sm font-semibold text-ischia-navy">{message}</p> : null}

      <div className="mt-5 grid gap-4">
        {items.map((item, index) => (
          <div key={item.id} className="rounded-2xl border border-ischia-blue/15 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-ischia-blue">Voce {index + 1}</p>
              <label className="flex items-center gap-2 text-sm font-bold text-ischia-navy">
                <input type="checkbox" checked={item.isActive} onChange={(event) => updateItem(item.id, { isActive: event.currentTarget.checked })} />
                Attiva
              </label>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-12">
              <Input className="md:col-span-8" label="Nome servizio" value={item.title} onChange={(value) => updateItem(item.id, { title: value })} />
              <NumberInput className="md:col-span-2" label="Prezzo da €" value={item.priceFrom} onChange={(value) => updateItem(item.id, { priceFrom: value })} />
              <NumberInput className="md:col-span-2" label="Ordinamento" value={item.sortOrder} integer onChange={(value) => updateItem(item.id, { sortOrder: value })} />
              <Input className="md:col-span-8" label="Descrizione breve opzionale" value={item.description} onChange={(value) => updateItem(item.id, { description: value })} />
              <Input className="md:col-span-4" label="Suffisso prezzo" value={item.priceSuffix} onChange={(value) => updateItem(item.id, { priceSuffix: value })} />
            </div>
          </div>
        ))}
        {items.length === 0 ? <p className="text-sm text-ischia-ink/60">Nessuna voce configurata.</p> : null}
      </div>

      <button type="button" disabled={loading} onClick={() => void save()} className="mt-5 rounded-full bg-ischia-navy px-5 py-3 text-sm font-black text-white disabled:opacity-60">
        {loading ? "Salvataggio..." : "Salva servizi extra"}
      </button>
    </section>
  );
}

function Input({ className = "", label, value, onChange }: { className?: string; label: string; value: string; onChange: (value: string) => void }) {
  return <label className={`text-sm font-semibold text-ischia-ink ${className}`}>{label}<input className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2" value={value} onChange={(event) => onChange(event.currentTarget.value)} /></label>;
}

function NumberInput({ className = "", label, value, integer = false, onChange }: { className?: string; label: string; value: number; integer?: boolean; onChange: (value: number) => void }) {
  return <label className={`text-sm font-semibold text-ischia-ink ${className}`}>{label}<input min="0" step={integer ? "1" : "0.01"} type="number" className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2" value={value} onChange={(event) => onChange(Number(event.currentTarget.value))} /></label>;
}
