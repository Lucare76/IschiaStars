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
            Modifica i testi commerciali ricorrenti e le CTA condivise della pagina cliente senza intervenire sul codice. La struttura grafica e la logica di conferma restano protette.
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

          <div className="border-t border-slate-200 pt-4">
            <p className="mb-3 text-xs font-black uppercase tracking-wide text-ischia-ink/50">Pulsanti e CTA</p>
            <div className="space-y-4">
              <Field label="WhatsApp intestazione" value={form.headerWhatsappLabel} onChange={(value) => update("headerWhatsappLabel", value)} />
              <Field label="CTA WhatsApp principale" value={form.mainWhatsappLabel} onChange={(value) => update("mainWhatsappLabel", value)} />
              <Field label="CTA conferma principale" value={form.mainConfirmLabel} onChange={(value) => update("mainConfirmLabel", value)} />
              <Field label="WhatsApp mobile" value={form.mobileWhatsappLabel} onChange={(value) => update("mobileWhatsappLabel", value)} />
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4">
            <p className="mb-3 text-xs font-black uppercase tracking-wide text-ischia-ink/50">Sezione viaggio e collegamenti</p>
            <div className="space-y-4">
              <Field label="Etichetta sezione viaggio" value={form.travelEyebrow} onChange={(value) => update("travelEyebrow", value)} />
              <Field label="Titolo sezione viaggio" value={form.travelTitle} onChange={(value) => update("travelTitle", value)} />
              <TextArea label="Descrizione sezione viaggio" value={form.travelDescription} onChange={(value) => update("travelDescription", value)} />
              <TextArea label="Nota tariffe viaggio" value={form.travelDisclaimer} onChange={(value) => update("travelDisclaimer", value)} />
              <TextArea label="CTA finale viaggio" value={form.travelCta} onChange={(value) => update("travelCta", value)} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-ischia-mist/60 p-5 ring-1 ring-ischia-blue/10">
          <p className="text-xs font-black uppercase tracking-wide text-ischia-ink/50">Anteprima rapida</p>
          <p className="mt-3 text-2xl font-black text-ischia-navy">{form.singleHeroTitle}</p>
          <p className="mt-2 text-sm leading-6 text-ischia-ink/70">Ciao Maria, {form.singleHeroIntro}</p>
          <div className="mt-6 border-t border-ischia-blue/10 pt-4">
            <p className="text-xl font-black text-ischia-navy">{form.proposalsTitle}</p>
            <p className="mt-2 text-sm leading-6 text-ischia-ink/70">{form.proposalsDescription}</p>
          </div>
          <div className="mt-6 grid gap-2 border-t border-ischia-blue/10 pt-4">
            <PreviewButton>{form.headerWhatsappLabel}</PreviewButton>
            <PreviewButton>{form.mainWhatsappLabel}</PreviewButton>
            <PreviewButton>{form.mainConfirmLabel}</PreviewButton>
            <PreviewButton>{form.mobileWhatsappLabel}</PreviewButton>
          </div>
          <div className="mt-6 border-t border-ischia-blue/10 pt-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-ischia-blue">{form.travelEyebrow}</p>
            <p className="mt-1 text-xl font-black text-ischia-navy">{form.travelTitle}</p>
            <p className="mt-2 text-sm leading-6 text-ischia-ink/70">{form.travelDescription}</p>
            <p className="mt-3 text-xs text-ischia-ink/55">{form.travelDisclaimer}</p>
            <p className="mt-2 text-sm font-semibold text-ischia-navy">{form.travelCta}</p>
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

function PreviewButton({ children }: { children: string }) {
  return <div className="rounded-full bg-white px-3 py-2 text-center text-xs font-black text-ischia-navy ring-1 ring-ischia-blue/10">{children}</div>;
}
