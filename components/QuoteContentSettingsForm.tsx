"use client";

import { useState } from "react";
import { adminApiErrorMessage, adminApiFetch, adminApiHeaders, readAdminApiJson } from "@/lib/admin-api-client";
import type { QuoteContentSettings } from "@/lib/quote-content-settings";

export function QuoteContentSettingsForm({ initialSettings }: { initialSettings: QuoteContentSettings }) {
  const [form, setForm] = useState(initialSettings);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function update<K extends keyof QuoteContentSettings>(key: K, value: QuoteContentSettings[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    setLoading(true);
    setMessage(null);
    try {
      const response = await adminApiFetch("/api/settings/quote-content", {
        method: "PATCH",
        headers: adminApiHeaders(),
        body: JSON.stringify(form)
      });
      const payload = await readAdminApiJson<{ ok?: boolean; data?: QuoteContentSettings; error?: string }>(response);
      if (!response.ok || !payload?.ok || !payload.data) {
        throw new Error(adminApiErrorMessage(response, payload, "Salvataggio non riuscito"));
      }
      setForm(payload.data);
      setMessage("Testi preventivo salvati.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Salvataggio non riuscito");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl bg-white/90 p-5 shadow-soft">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-xl font-black text-ischia-navy">Testi pagina preventivo</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-ischia-ink/70">
            Modifica i testi commerciali ricorrenti della pagina cliente senza intervenire sul codice. La struttura grafica e la logica di conferma restano protette.
          </p>
        </div>
        <button
          className="rounded-full bg-ischia-navy px-5 py-2.5 text-sm font-black text-white disabled:opacity-50"
          disabled={loading}
          onClick={() => void save()}
          type="button"
        >
          {loading ? "Salvataggio..." : "Salva testi preventivo"}
        </button>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <div className="space-y-4">
          <Field label="Titolo con una proposta" value={form.singleHeroTitle} onChange={(value) => update("singleHeroTitle", value)} />
          <Field label="Titolo con più proposte" value={form.multipleHeroTitle} onChange={(value) => update("multipleHeroTitle", value)} />
          <TextArea label="Testo introduttivo con una proposta" value={form.singleHeroIntro} onChange={(value) => update("singleHeroIntro", value)} />
          <TextArea label="Testo introduttivo con più proposte" value={form.multipleHeroIntro} onChange={(value) => update("multipleHeroIntro", value)} />
          <Field label="Titolo sezione proposte" value={form.proposalsTitle} onChange={(value) => update("proposalsTitle", value)} />
          <TextArea label="Descrizione sezione proposte" value={form.proposalsDescription} onChange={(value) => update("proposalsDescription", value)} />
        </div>

        <div className="rounded-2xl bg-ischia-mist/60 p-5 ring-1 ring-ischia-blue/10">
          <p className="text-xs font-black uppercase tracking-wide text-ischia-ink/50">Anteprima rapida</p>
          <p className="mt-3 text-2xl font-black text-ischia-navy">{form.singleHeroTitle}</p>
          <p className="mt-2 text-sm leading-6 text-ischia-ink/70">Ciao Maria, {form.singleHeroIntro}</p>
          <div className="mt-6 border-t border-ischia-blue/10 pt-4">
            <p className="text-xl font-black text-ischia-navy">{form.proposalsTitle}</p>
            <p className="mt-2 text-sm leading-6 text-ischia-ink/70">{form.proposalsDescription}</p>
          </div>
        </div>
      </div>

      {message ? <p className="mt-4 text-sm font-bold text-ischia-navy">{message}</p> : null}
    </section>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm font-bold text-ischia-ink">
      {label}
      <input className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm font-bold text-ischia-ink">
      {label}
      <textarea className="mt-1 min-h-24 w-full rounded-xl border border-ischia-blue/20 px-3 py-3 leading-6" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
