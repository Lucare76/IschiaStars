"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { adminApiErrorMessage, adminApiFetch, readAdminApiJson } from "@/lib/admin-api-client";
import { FEATURE_FLAG_DEFINITIONS, FeatureFlagKey, FeatureFlags } from "@/lib/feature-flags";
import { formatDateTime } from "@/lib/utils";

type LabTestQuote = {
  id: string;
  code: string;
  clientName: string;
  createdAt: string;
  publicUrl: string;
};

export function LabPageClient({
  initialFlags,
  initialTestQuotes
}: {
  initialFlags: FeatureFlags;
  initialTestQuotes: LabTestQuote[];
}) {
  return (
    <div className="grid gap-6">
      <div className="rounded-2xl bg-[#4C1D95] px-6 py-3 text-sm font-black text-white shadow-soft">
        🔬 Pannello Supervisor — Visibile solo a te
      </div>

      <FeatureFlagsSection initialFlags={initialFlags} />
      <TestQuotesSection initialTestQuotes={initialTestQuotes} />
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

    // Mantieni lo stato ottimistico: aggiorna solo il flag toccato
    setFlags((current) => ({ ...current, [flag]: value }));
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

function TestQuotesSection({ initialTestQuotes }: { initialTestQuotes: LabTestQuote[] }) {
  const router = useRouter();
  const [testQuotes, setTestQuotes] = useState(initialTestQuotes);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

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

      <button
        type="button"
        onClick={() => router.push("/admin/preventivi/nuovo?lab=true")}
        className="mt-5 rounded-full bg-[#1B3A5C] px-5 py-2 text-sm font-medium text-white"
      >
        + Crea preventivo di test
      </button>

      {error ? <p className="mt-3 text-sm font-semibold text-red-600">{error}</p> : null}

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
                      <Link
                        href={`/admin/preventivi/${quote.code}`}
                        className="rounded-full bg-ischia-leaf px-3 py-1.5 text-xs font-bold text-white"
                      >
                        Gestisci / invia email
                      </Link>
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
