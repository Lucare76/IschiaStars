"use client";

import { useState } from "react";
import { adminApiErrorMessage, adminApiFetch, adminApiHeaders, readAdminApiJson } from "@/lib/admin-api-client";
import { FollowUpRuleSettings } from "@/lib/follow-up-rule-settings";

export function FollowUpRuleSettingsForm({ initialSettings }: { initialSettings: FollowUpRuleSettings }) {
  const [form, setForm] = useState(initialSettings);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function updateNumber(key: keyof FollowUpRuleSettings, value: string) {
    setForm((current) => ({ ...current, [key]: Number(value) }));
  }

  async function save() {
    setLoading(true);
    setMessage(null);
    try {
      const response = await adminApiFetch("/api/settings/follow-up-rules", {
        method: "PATCH",
        headers: adminApiHeaders(),
        body: JSON.stringify(form)
      });
      const payload = await readAdminApiJson<{ ok?: boolean; data?: FollowUpRuleSettings; error?: string }>(response);
      if (!response.ok || !payload?.ok || !payload.data) {
        throw new Error(adminApiErrorMessage(response, payload, "Salvataggio non riuscito"));
      }
      setForm(payload.data);
      setMessage("Regole follow-up salvate.");
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
          <h2 className="text-xl font-black text-ischia-navy">Tempi e regole follow-up</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-ischia-ink/70">
            Imposta quando un preventivo entra nelle varie fasi di sollecito. Il sistema applica limiti minimi e massimi per evitare configurazioni rischiose.
          </p>
        </div>
        <button
          className="rounded-full bg-ischia-navy px-5 py-2.5 text-sm font-black text-white disabled:opacity-50"
          disabled={loading}
          onClick={() => void save()}
          type="button"
        >
          {loading ? "Salvataggio..." : "Salva regole"}
        </button>
      </div>

      <label className="mt-5 flex items-center gap-3 rounded-xl bg-ischia-mist/60 px-4 py-3 text-sm font-bold text-ischia-navy">
        <input
          checked={form.enabled}
          onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))}
          type="checkbox"
        />
        Attiva classificazione automatica dei follow-up
      </label>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <NumberField label="Non visualizzato dopo" value={form.unopenedAfterHours} min={6} max={168} onChange={(value) => updateNumber("unopenedAfterHours", value)} />
        <NumberField label="Aperto da sollecitare dopo" value={form.openedReminderAfterHours} min={6} max={168} onChange={(value) => updateNumber("openedReminderAfterHours", value)} />
        <NumberField label="Primo sollecito" value={form.firstReminderAfterHours} min={6} max={168} onChange={(value) => updateNumber("firstReminderAfterHours", value)} />
        <NumberField label="Secondo sollecito" value={form.secondReminderAfterHours} min={12} max={336} onChange={(value) => updateNumber("secondReminderAfterHours", value)} />
        <NumberField label="Ultimo contatto" value={form.finalReminderAfterHours} min={18} max={720} onChange={(value) => updateNumber("finalReminderAfterHours", value)} />
      </div>

      <p className="mt-4 text-xs leading-5 text-ischia-ink/55">
        Valori espressi in ore. Il secondo sollecito viene sempre mantenuto dopo il primo e l&apos;ultimo contatto dopo il secondo, anche se vengono inseriti valori incoerenti.
      </p>
      {message ? <p className="mt-4 text-sm font-bold text-ischia-navy">{message}</p> : null}
    </section>
  );
}

function NumberField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: string) => void }) {
  return (
    <label className="text-sm font-bold text-ischia-ink">
      {label}
      <div className="mt-1 flex items-center gap-2">
        <input
          className="w-full rounded-xl border border-ischia-blue/20 px-3 py-2"
          max={max}
          min={min}
          onChange={(event) => onChange(event.target.value)}
          type="number"
          value={value}
        />
        <span className="text-xs font-bold text-ischia-ink/50">ore</span>
      </div>
    </label>
  );
}
