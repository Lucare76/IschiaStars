"use client";

import { useMemo, useState } from "react";
import { adminApiErrorMessage, adminApiFetch, adminApiHeaders, readAdminApiJson } from "@/lib/admin-api-client";
import { FOLLOW_UP_VARIABLES, FollowUpSettings, FollowUpTemplate } from "@/lib/follow-up-settings";

const previewValues: Record<string, string> = {
  nome: "Maria",
  codice: "IS-2026-2500",
  hotel: "Hotel Terme Example",
  arrivo: "21 settembre 2026",
  partenza: "28 settembre 2026",
  prezzo: "€ 799",
  link_preventivo: "https://preventivi.ischiastars.it/p/ABC123"
};

function renderPreview(value: string) {
  return Object.entries(previewValues).reduce(
    (output, [key, replacement]) => output.split(`{${key}}`).join(replacement),
    value
  );
}

export function FollowUpSettingsForm({ initialSettings }: { initialSettings: FollowUpSettings }) {
  const [form, setForm] = useState(initialSettings);
  const [selectedKey, setSelectedKey] = useState(form.templates[0]?.key ?? "default");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selected = form.templates.find((item) => item.key === selectedKey) ?? form.templates[0];
  const preview = useMemo(() => selected ? renderPreview(selected.message) : "", [selected]);
  const emailSubjectPreview = useMemo(() => renderPreview(form.email.subject), [form.email.subject]);
  const emailBodyPreview = useMemo(() => renderPreview(form.email.body), [form.email.body]);
  const emailSignaturePreview = useMemo(() => renderPreview(form.email.signature), [form.email.signature]);

  function updateTemplate(patch: Partial<FollowUpTemplate>) {
    if (!selected) return;
    setForm((current) => ({
      ...current,
      templates: current.templates.map((item) => item.key === selected.key ? { ...item, ...patch } : item)
    }));
  }

  function insertVariable(token: string) {
    if (!selected) return;
    updateTemplate({ message: `${selected.message}${selected.message.endsWith(" ") || !selected.message ? "" : " "}${token}` });
  }

  async function save() {
    setLoading(true);
    setMessage(null);
    try {
      const response = await adminApiFetch("/api/settings/follow-up", {
        method: "PATCH",
        headers: adminApiHeaders(),
        body: JSON.stringify(form)
      });
      const payload = await readAdminApiJson<{ ok?: boolean; data?: FollowUpSettings; error?: string }>(response);
      if (!response.ok || !payload?.ok || !payload.data) {
        throw new Error(adminApiErrorMessage(response, payload, "Salvataggio non riuscito"));
      }
      setForm(payload.data);
      setMessage("Impostazioni follow-up salvate.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Salvataggio non riuscito");
    } finally {
      setLoading(false);
    }
  }

  if (!selected) return null;

  return (
    <section className="rounded-2xl bg-white/90 p-5 shadow-soft">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-xl font-black text-ischia-navy">Comunicazioni follow-up</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-ischia-ink/70">
            Diego può modificare WhatsApp ed email senza interventi sul codice. Le variabili vengono sostituite automaticamente con i dati reali del preventivo.
          </p>
        </div>
        <button className="rounded-full bg-ischia-navy px-5 py-2.5 text-sm font-black text-white disabled:opacity-50" disabled={loading} onClick={() => void save()} type="button">
          {loading ? "Salvataggio..." : "Salva comunicazioni"}
        </button>
      </div>

      <div className="mt-6 border-t border-slate-200 pt-5">
        <h3 className="text-base font-black text-ischia-navy">WhatsApp</h3>
        <div className="mt-4 flex flex-wrap gap-2">
          {form.templates.map((template) => (
            <button key={template.key} className={`rounded-full px-4 py-2 text-sm font-black ring-1 ${selected.key === template.key ? "bg-ischia-blue text-white ring-ischia-blue" : "bg-white text-ischia-navy ring-ischia-blue/20"}`} onClick={() => setSelectedKey(template.key)} type="button">
              {template.label}
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          <div>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <label className="text-sm font-bold text-ischia-ink">Nome template
                <input className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2" value={selected.label} onChange={(event) => updateTemplate({ label: event.target.value })} />
              </label>
              <label className="flex items-center gap-2 rounded-xl bg-ischia-mist/60 px-4 py-2.5 text-sm font-bold text-ischia-navy">
                <input checked={selected.enabled} onChange={(event) => updateTemplate({ enabled: event.target.checked })} type="checkbox" />
                Attivo
              </label>
            </div>

            <label className="mt-4 block text-sm font-bold text-ischia-ink">Messaggio WhatsApp
              <textarea className="mt-1 min-h-64 w-full rounded-xl border border-ischia-blue/20 px-3 py-3 leading-6" value={selected.message} onChange={(event) => updateTemplate({ message: event.target.value })} />
            </label>

            <div className="mt-3">
              <p className="text-xs font-black uppercase tracking-wide text-ischia-ink/50">Inserisci variabile</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {FOLLOW_UP_VARIABLES.map((variable) => (
                  <button key={variable.token} className="rounded-full bg-ischia-mist px-3 py-1.5 text-xs font-black text-ischia-navy ring-1 ring-ischia-blue/10" onClick={() => insertVariable(variable.token)} type="button">
                    {variable.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200">
            <p className="text-xs font-black uppercase tracking-wide text-ischia-ink/45">Anteprima WhatsApp</p>
            <div className="mt-3 whitespace-pre-wrap rounded-2xl bg-white p-4 text-sm leading-6 text-ischia-ink shadow-sm ring-1 ring-slate-200">{preview}</div>
          </div>
        </div>
      </div>

      <div className="mt-7 border-t border-slate-200 pt-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-black text-ischia-navy">Email follow-up</h3>
            <p className="mt-1 text-sm text-ischia-ink/65">La grafica resta protetta; Diego modifica solo oggetto, testo e firma.</p>
          </div>
          <label className="flex items-center gap-2 rounded-xl bg-ischia-mist/60 px-4 py-2.5 text-sm font-bold text-ischia-navy">
            <input checked={form.email.enabled} onChange={(event) => setForm((current) => ({ ...current, email: { ...current.email, enabled: event.target.checked } }))} type="checkbox" />
            Email attiva
          </label>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          <div className="space-y-4">
            <label className="block text-sm font-bold text-ischia-ink">Oggetto
              <input className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2" value={form.email.subject} onChange={(event) => setForm((current) => ({ ...current, email: { ...current.email, subject: event.target.value } }))} />
            </label>
            <label className="block text-sm font-bold text-ischia-ink">Corpo email
              <textarea className="mt-1 min-h-52 w-full rounded-xl border border-ischia-blue/20 px-3 py-3 leading-6" value={form.email.body} onChange={(event) => setForm((current) => ({ ...current, email: { ...current.email, body: event.target.value } }))} />
            </label>
            <label className="block text-sm font-bold text-ischia-ink">Firma
              <textarea className="mt-1 min-h-24 w-full rounded-xl border border-ischia-blue/20 px-3 py-3 leading-6" value={form.email.signature} onChange={(event) => setForm((current) => ({ ...current, email: { ...current.email, signature: event.target.value } }))} />
            </label>
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-ischia-ink/50">Variabili disponibili</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {FOLLOW_UP_VARIABLES.map((variable) => <span key={variable.token} className="rounded-full bg-ischia-mist px-3 py-1.5 text-xs font-black text-ischia-navy">{variable.token}</span>)}
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200">
            <p className="text-xs font-black uppercase tracking-wide text-ischia-ink/45">Anteprima email</p>
            <div className="mt-3 rounded-2xl bg-white p-4 text-sm text-ischia-ink shadow-sm ring-1 ring-slate-200">
              <p className="font-black">{emailSubjectPreview}</p>
              <div className="mt-4 whitespace-pre-wrap leading-6">{emailBodyPreview}</div>
              <div className="mt-4 whitespace-pre-wrap border-t border-slate-100 pt-4 leading-6">{emailSignaturePreview}</div>
            </div>
            <p className="mt-3 text-xs leading-5 text-ischia-ink/55">L&apos;anteprima usa dati di esempio. Il layout definitivo dell&apos;email resta gestito dal sistema.</p>
          </div>
        </div>
      </div>

      {message ? <p className="mt-4 text-sm font-bold text-ischia-navy">{message}</p> : null}
    </section>
  );
}
