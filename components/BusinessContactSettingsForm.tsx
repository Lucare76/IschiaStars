"use client";

import { useState } from "react";
import { BusinessContactSettings } from "@/lib/business-contact-settings";
import { adminApiErrorMessage, adminApiFetch, adminApiHeaders, readAdminApiJson } from "@/lib/admin-api-client";

export function BusinessContactSettingsForm({ initialSettings }: { initialSettings: BusinessContactSettings }) {
  const [form, setForm] = useState(initialSettings);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function save() {
    setLoading(true);
    setMessage(null);
    try {
      const response = await adminApiFetch("/api/settings/business-contacts", {
        method: "PATCH",
        headers: adminApiHeaders(),
        body: JSON.stringify(form)
      });
      const payload = await readAdminApiJson<{ ok?: boolean; data?: BusinessContactSettings; error?: string }>(response);
      if (!response.ok || !payload?.ok || !payload.data) {
        throw new Error(adminApiErrorMessage(response, payload, "Salvataggio non riuscito"));
      }
      setForm(payload.data);
      setMessage("Contatti salvati.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Salvataggio non riuscito");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl bg-white/90 p-5 shadow-soft">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-black text-ischia-navy">Contatti IschiaStars</h2>
          <p className="mt-1 text-sm leading-6 text-ischia-ink/70">Questi dati diventano la fonte unica per i contatti commerciali modificabili dall&apos;admin.</p>
        </div>
        <button className="rounded-full bg-ischia-navy px-5 py-2.5 text-sm font-black text-white disabled:opacity-50" disabled={loading} onClick={() => void save()} type="button">
          {loading ? "Salvataggio..." : "Salva contatti"}
        </button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="text-sm font-bold text-ischia-ink">Telefono
          <input className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
        </label>
        <label className="text-sm font-bold text-ischia-ink">WhatsApp
          <input className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2" value={form.whatsapp} onChange={(event) => setForm((current) => ({ ...current, whatsapp: event.target.value }))} />
        </label>
        <label className="text-sm font-bold text-ischia-ink">Email
          <input className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
        </label>
        <label className="text-sm font-bold text-ischia-ink">Sito web
          <input className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2" value={form.website} onChange={(event) => setForm((current) => ({ ...current, website: event.target.value }))} />
        </label>
      </div>

      {message ? <p className="mt-4 text-sm font-bold text-ischia-navy">{message}</p> : null}
    </section>
  );
}
