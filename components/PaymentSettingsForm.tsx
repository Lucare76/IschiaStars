"use client";

import { useState } from "react";
import { adminApiHeaders } from "@/lib/admin-api-client";
import { isPaymentSettingsConfigured, PaymentSettings } from "@/lib/payment-settings";

export function PaymentSettingsForm({ initialSettings }: { initialSettings: PaymentSettings }) {
  const [form, setForm] = useState({
    ...initialSettings,
    acceptedBalanceMethodsText: initialSettings.acceptedBalanceMethods.join(", ")
  });
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function save() {
    setLoading(true);
    setMessage(null);
    const response = await fetch("/api/settings/payment", {
      method: "PATCH",
      headers: adminApiHeaders(),
      body: JSON.stringify({
        ...form,
        acceptedBalanceMethods: form.acceptedBalanceMethodsText.split(",").map((item) => item.trim()).filter(Boolean)
      })
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; data?: PaymentSettings; warning?: string; error?: string } | null;
    setLoading(false);
    if (!response.ok || !result?.ok || !result.data) {
      setMessage(result?.error ?? "Salvataggio non riuscito");
      return;
    }
    setForm({ ...result.data, acceptedBalanceMethodsText: result.data.acceptedBalanceMethods.join(", ") });
    setMessage(result.warning ? `Coordinate salvate. ${result.warning}` : "Coordinate pagamento salvate.");
  }

  return (
    <section className="rounded-2xl bg-white/90 p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-ischia-navy">Coordinate pagamento</h2>
          <p className="mt-1 text-sm text-ischia-ink/68">Dati mostrati al cliente nel riepilogo della conferma.</p>
        </div>
        {!isPaymentSettingsConfigured(form) ? (
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-800 ring-1 ring-amber-200">Coordinate non configurate</span>
        ) : null}
      </div>

      {message ? <p className="mt-3 rounded-xl bg-ischia-mist p-3 text-sm font-semibold text-ischia-navy">{message}</p> : null}

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <Input label="Intestatario" value={form.bankAccountHolder} onChange={(value) => setForm({ ...form, bankAccountHolder: value })} />
        <Input label="Banca" value={form.bankName} onChange={(value) => setForm({ ...form, bankName: value })} />
        <Input label="IBAN" value={form.iban} onChange={(value) => setForm({ ...form, iban: value })} />
        <Input label="BIC/SWIFT" value={form.bicSwift} onChange={(value) => setForm({ ...form, bicSwift: value })} />
        <Input label="Causale bonifico" value={form.paymentReasonPrefix} onChange={(value) => setForm({ ...form, paymentReasonPrefix: value })} />
        <Input label="Modalita saldo" value={form.acceptedBalanceMethodsText} onChange={(value) => setForm({ ...form, acceptedBalanceMethodsText: value })} />
        <Textarea label="Istruzioni per il cliente" value={form.paymentInstructions} onChange={(value) => setForm({ ...form, paymentInstructions: value })} />
      </div>

      <button className="mt-4 rounded-full bg-ischia-navy px-5 py-3 text-sm font-black text-white disabled:opacity-60" disabled={loading} onClick={() => void save()} type="button">
        {loading ? "Salvataggio..." : "Salva coordinate"}
      </button>
    </section>
  );
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="text-sm font-semibold text-ischia-ink">{label}<input className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function Textarea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block text-sm font-semibold text-ischia-ink lg:col-span-2">{label}<textarea className="mt-1 min-h-24 w-full rounded-xl border border-ischia-blue/20 px-3 py-2" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}
