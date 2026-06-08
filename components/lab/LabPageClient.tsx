"use client";

import { useState } from "react";
import { adminApiErrorMessage, adminApiFetch, readAdminApiJson } from "@/lib/admin-api-client";
import { FEATURE_FLAG_DEFINITIONS, FeatureFlagKey, FeatureFlags } from "@/lib/feature-flags";
import { formatDateTime } from "@/lib/utils";

type LabHotel = { id: string; name: string };

type LabTestQuote = {
  id: string;
  code: string;
  clientName: string;
  createdAt: string;
  publicUrl: string;
};

const TREATMENTS: { value: "BB" | "HB" | "FB"; label: string }[] = [
  { value: "BB", label: "Camera e colazione (BB)" },
  { value: "HB", label: "Mezza pensione (HB)" },
  { value: "FB", label: "Pensione completa (FB)" }
];

export function LabPageClient({
  initialFlags,
  hotels,
  initialTestQuotes
}: {
  initialFlags: FeatureFlags;
  hotels: LabHotel[];
  initialTestQuotes: LabTestQuote[];
}) {
  return (
    <div className="grid gap-6">
      <div className="rounded-2xl bg-[#4C1D95] px-6 py-3 text-sm font-black text-white shadow-soft">
        🔬 Pannello Supervisor — Visibile solo a te
      </div>

      <FeatureFlagsSection initialFlags={initialFlags} />
      <TestQuotesSection hotels={hotels} initialTestQuotes={initialTestQuotes} />
    </div>
  );
}

function FeatureFlagsSection({ initialFlags }: { initialFlags: FeatureFlags }) {
  const [flags, setFlags] = useState(initialFlags);
  const [pendingFlag, setPendingFlag] = useState<FeatureFlagKey | null>(null);
  const [savedFlag, setSavedFlag] = useState<FeatureFlagKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle(flag: FeatureFlagKey, value: boolean) {
    setError(null);
    setPendingFlag(flag);
    setFlags((current) => ({ ...current, [flag]: value }));

    const response = await adminApiFetch("/api/supervisor/feature-flags", {
      method: "POST",
      body: JSON.stringify({ flag, value })
    });
    const result = await readAdminApiJson<{ ok?: boolean; data?: FeatureFlags; error?: string }>(response);
    setPendingFlag(null);

    if (!response.ok || !result?.ok || !result.data) {
      setFlags((current) => ({ ...current, [flag]: !value }));
      setError(adminApiErrorMessage(response, result, "Salvataggio non riuscito. Riprova."));
      return;
    }

    setFlags(result.data);
    setSavedFlag(flag);
    setTimeout(() => setSavedFlag((current) => (current === flag ? null : current)), 2000);
  }

  return (
    <section className="rounded-2xl bg-white/90 p-6 shadow-soft">
      <h2 className="text-xl font-black text-ischia-navy">Funzionalità nascoste</h2>
      <p className="mt-1 text-sm text-ischia-ink/60">Attiva o disattiva funzionalità in sviluppo, visibili solo internamente.</p>

      {error ? <p className="mt-3 text-sm font-semibold text-red-600">{error}</p> : null}

      <div className="mt-5 grid gap-3">
        {FEATURE_FLAG_DEFINITIONS.map((definition) => (
          <div key={definition.key} className="flex items-center justify-between gap-4 rounded-xl bg-ischia-mist p-4">
            <div>
              <p className="font-mono text-sm font-bold text-ischia-navy">{definition.label}</p>
              <p className="mt-1 text-xs text-ischia-ink/60">{definition.description}</p>
            </div>
            <div className="flex items-center gap-3">
              {savedFlag === definition.key ? <span className="text-xs font-bold text-emerald-600">✓ Salvato</span> : null}
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={flags[definition.key]}
                  disabled={pendingFlag === definition.key}
                  onChange={(event) => handleToggle(definition.key, event.currentTarget.checked)}
                />
                <span className="h-6 w-11 rounded-full bg-slate-300 transition peer-checked:bg-emerald-500 peer-disabled:opacity-50" />
                <span className="absolute left-1 h-4 w-4 rounded-full bg-white transition peer-checked:translate-x-5" />
              </label>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function TestQuotesSection({ hotels, initialTestQuotes }: { hotels: LabHotel[]; initialTestQuotes: LabTestQuote[] }) {
  const [testQuotes, setTestQuotes] = useState(initialTestQuotes);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCreatedUrl, setLastCreatedUrl] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLastCreatedUrl(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const response = await adminApiFetch("/api/supervisor/test-quotes", {
      method: "POST",
      body: JSON.stringify({
        clientFirstName: formData.get("clientFirstName"),
        checkIn: formData.get("checkIn"),
        checkOut: formData.get("checkOut"),
        adults: Number(formData.get("adults") ?? 2),
        hotelId: formData.get("hotelId"),
        treatment: formData.get("treatment"),
        price: Number(formData.get("price"))
      })
    });
    const result = await readAdminApiJson<{ ok?: boolean; data?: LabTestQuote; error?: string }>(response);
    setLoading(false);

    if (!response.ok || !result?.ok || !result.data) {
      setError(adminApiErrorMessage(response, result, "Creazione non riuscita. Riprova."));
      return;
    }

    setTestQuotes((current) => [result.data!, ...current]);
    setLastCreatedUrl(result.data.publicUrl);
    event.currentTarget.reset();
  }

  async function handleDelete(id: string) {
    setError(null);
    const response = await adminApiFetch(`/api/supervisor/test-quotes/${id}`, { method: "DELETE" });
    const result = await readAdminApiJson<{ ok?: boolean; error?: string }>(response);
    setConfirmingDeleteId(null);

    if (!response.ok || !result?.ok) {
      setError(adminApiErrorMessage(response, result, "Eliminazione non riuscita. Riprova."));
      return;
    }

    setTestQuotes((current) => current.filter((quote) => quote.id !== id));
  }

  return (
    <section className="rounded-2xl bg-white/90 p-6 shadow-soft">
      <h2 className="text-xl font-black text-ischia-navy">Preventivi di test</h2>
      <p className="mt-1 text-sm text-ischia-ink/60">Crea preventivi fittizi per testare il flusso cliente. Non vengono mai mostrati a Diego né conteggiati nelle statistiche.</p>

      <form onSubmit={handleSubmit} className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Nome cliente">
          <input name="clientFirstName" defaultValue="Test Supervisor" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        </Field>
        <Field label="Check-in">
          <input name="checkIn" type="date" required className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        </Field>
        <Field label="Check-out">
          <input name="checkOut" type="date" required className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        </Field>
        <Field label="Adulti">
          <input name="adults" type="number" min={1} defaultValue={2} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        </Field>
        <Field label="Hotel">
          <select name="hotelId" required defaultValue="" className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="" disabled>Seleziona un hotel</option>
            {hotels.map((hotel) => (
              <option key={hotel.id} value={hotel.id}>{hotel.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Trattamento">
          <select name="treatment" required defaultValue="" className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="" disabled>Seleziona</option>
            {TREATMENTS.map((treatment) => (
              <option key={treatment.value} value={treatment.value}>{treatment.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Prezzo (€)">
          <input name="price" type="number" min={1} step="0.01" required className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        </Field>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-ischia-navy px-5 py-2.5 text-sm font-black text-white disabled:opacity-50"
          >
            {loading ? "Creazione…" : "Crea preventivo di test"}
          </button>
        </div>
      </form>

      {error ? <p className="mt-3 text-sm font-semibold text-red-600">{error}</p> : null}
      {lastCreatedUrl ? (
        <p className="mt-3 text-sm font-semibold text-emerald-700">
          Preventivo creato — <a href={lastCreatedUrl} target="_blank" rel="noreferrer" className="underline">apri il link pubblico</a>
        </p>
      ) : null}

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="text-xs font-bold uppercase tracking-wide text-ischia-ink/50">
              <th className="py-2 pr-4">Codice</th>
              <th className="py-2 pr-4">Cliente</th>
              <th className="py-2 pr-4">Creato il</th>
              <th className="py-2 pr-4">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {testQuotes.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-4 text-ischia-ink/50">Nessun preventivo di test creato.</td>
              </tr>
            ) : (
              testQuotes.map((quote) => (
                <tr key={quote.id} className="border-t border-slate-100">
                  <td className="py-2 pr-4 font-bold text-ischia-navy">{quote.code}</td>
                  <td className="py-2 pr-4">{quote.clientName}</td>
                  <td className="py-2 pr-4 text-ischia-ink/60">{formatDateTime(quote.createdAt)}</td>
                  <td className="py-2 pr-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={quote.publicUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full bg-ischia-mist px-3 py-1.5 text-xs font-bold text-ischia-navy"
                      >
                        Apri come cliente
                      </a>
                      {confirmingDeleteId === quote.id ? (
                        <span className="flex items-center gap-2 text-xs font-semibold">
                          Sei sicuro?
                          <button type="button" onClick={() => handleDelete(quote.id)} className="rounded-full bg-red-600 px-3 py-1 font-bold text-white">Sì, elimina</button>
                          <button type="button" onClick={() => setConfirmingDeleteId(null)} className="rounded-full bg-slate-200 px-3 py-1 font-bold text-ischia-ink">Annulla</button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmingDeleteId(quote.id)}
                          className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700"
                        >
                          Elimina
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-ischia-ink/60">
      {label}
      {children}
    </label>
  );
}
