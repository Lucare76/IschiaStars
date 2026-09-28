"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminApiErrorMessage, adminApiFetch, adminApiHeaders, readAdminApiJson } from "@/lib/admin-api-client";
import {
  configuredPaymentAccounts,
  isPaymentSettingsConfigured,
  PaymentSettings
} from "@/lib/payment-settings";

export function PaymentSettingsForm({ initialSettings }: { initialSettings: PaymentSettings }) {
  const router = useRouter();
  const [form, setForm] = useState({
    ...initialSettings,
    acceptedBalanceMethodsText: initialSettings.acceptedBalanceMethods.join(", ")
  });
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function save() {
    setLoading(true);
    setMessage(null);
    const response = await adminApiFetch("/api/settings/payment", {
      method: "PATCH",
      headers: adminApiHeaders(),
      body: JSON.stringify({
        ...form,
        acceptedBalanceMethods: form.acceptedBalanceMethodsText.split(",").map((item) => item.trim()).filter(Boolean)
      })
    });
    const result = await readAdminApiJson<{ ok?: boolean; data?: PaymentSettings; warning?: string; error?: string }>(response);
    setLoading(false);
    if (!response.ok || !result?.ok || !result.data) {
      setMessage(adminApiErrorMessage(response, result, "Salvataggio non riuscito."));
      return;
    }
    setForm({ ...result.data, acceptedBalanceMethodsText: result.data.acceptedBalanceMethods.join(", ") });
    setMessage(result.warning ? `Coordinate salvate. ${result.warning}` : "Coordinate pagamento salvate.");
    router.refresh();
  }

  const configuredAccounts = configuredPaymentAccounts(form);

  return (
    <section className="rounded-2xl bg-white/90 p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-ischia-navy">Coordinate pagamento</h2>
          <p className="mt-1 text-sm text-ischia-ink/68">
            Configura fino a due conti. Diego potrà scegliere quale IBAN comunicare quando invia la conferma definitiva.
          </p>
        </div>
        {!isPaymentSettingsConfigured(form) ? (
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-800 ring-1 ring-amber-200">Coordinate non configurate</span>
        ) : (
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800 ring-1 ring-emerald-200">
            {configuredAccounts.length} {configuredAccounts.length === 1 ? "conto configurato" : "conti configurati"}
          </span>
        )}
      </div>

      {message ? <p className="mt-3 rounded-xl bg-ischia-mist p-3 text-sm font-semibold text-ischia-navy">{message}</p> : null}

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <AccountCard
          title="Conto 1"
          label={form.primaryAccountLabel}
          accountHolder={form.bankAccountHolder}
          bankName={form.bankName}
          iban={form.iban}
          bicSwift={form.bicSwift}
          onLabel={(value) => setForm({ ...form, primaryAccountLabel: value })}
          onAccountHolder={(value) => setForm({ ...form, bankAccountHolder: value })}
          onBankName={(value) => setForm({ ...form, bankName: value })}
          onIban={(value) => setForm({ ...form, iban: value })}
          onBicSwift={(value) => setForm({ ...form, bicSwift: value })}
        />
        <AccountCard
          title="Conto 2"
          label={form.secondaryAccountLabel}
          accountHolder={form.secondaryBankAccountHolder}
          bankName={form.secondaryBankName}
          iban={form.secondaryIban}
          bicSwift={form.secondaryBicSwift}
          onLabel={(value) => setForm({ ...form, secondaryAccountLabel: value })}
          onAccountHolder={(value) => setForm({ ...form, secondaryBankAccountHolder: value })}
          onBankName={(value) => setForm({ ...form, secondaryBankName: value })}
          onIban={(value) => setForm({ ...form, secondaryIban: value })}
          onBicSwift={(value) => setForm({ ...form, secondaryBicSwift: value })}
        />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <label className="text-sm font-semibold text-ischia-ink">
          Conto predefinito
          <select
            className="mt-1 w-full rounded-xl border border-ischia-blue/20 bg-white px-3 py-2"
            value={form.defaultPaymentAccount}
            onChange={(event) => setForm({ ...form, defaultPaymentAccount: event.target.value === "secondary" ? "secondary" : "primary" })}
          >
            <option value="primary">{form.primaryAccountLabel || "Conto 1"}</option>
            <option value="secondary">{form.secondaryAccountLabel || "Conto 2"}</option>
          </select>
          <span className="mt-1 block text-xs font-normal text-ischia-ink/60">Viene pre-selezionato nella conferma, ma Diego può cambiarlo prima dell&apos;invio.</span>
        </label>
        <Input label="Causale bonifico" value={form.paymentReasonPrefix} onChange={(value) => setForm({ ...form, paymentReasonPrefix: value })} />
        <Input label="Modalità saldo" value={form.acceptedBalanceMethodsText} onChange={(value) => setForm({ ...form, acceptedBalanceMethodsText: value })} />
        <Textarea label="Istruzioni per il cliente" value={form.paymentInstructions} onChange={(value) => setForm({ ...form, paymentInstructions: value })} />
      </div>

      <button className="mt-4 rounded-full bg-ischia-navy px-5 py-3 text-sm font-black text-white disabled:opacity-60" disabled={loading} onClick={() => void save()} type="button">
        {loading ? "Salvataggio..." : "Salva coordinate"}
      </button>
    </section>
  );
}

function AccountCard({
  title,
  label,
  accountHolder,
  bankName,
  iban,
  bicSwift,
  onLabel,
  onAccountHolder,
  onBankName,
  onIban,
  onBicSwift
}: {
  title: string;
  label: string;
  accountHolder: string;
  bankName: string;
  iban: string;
  bicSwift: string;
  onLabel: (value: string) => void;
  onAccountHolder: (value: string) => void;
  onBankName: (value: string) => void;
  onIban: (value: string) => void;
  onBicSwift: (value: string) => void;
}) {
  return (
    <div className="rounded-2xl bg-ischia-mist/70 p-4 ring-1 ring-ischia-blue/10">
      <h3 className="font-black text-ischia-navy">{title}</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Input label="Nome conto" value={label} onChange={onLabel} />
        <Input label="Intestatario" value={accountHolder} onChange={onAccountHolder} />
        <Input label="Banca" value={bankName} onChange={onBankName} />
        <Input label="IBAN" value={iban} onChange={onIban} />
        <Input label="BIC/SWIFT" value={bicSwift} onChange={onBicSwift} />
      </div>
    </div>
  );
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="text-sm font-semibold text-ischia-ink">{label}<input className="mt-1 w-full rounded-xl border border-ischia-blue/20 bg-white px-3 py-2" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function Textarea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block text-sm font-semibold text-ischia-ink">{label}<textarea className="mt-1 min-h-24 w-full rounded-xl border border-ischia-blue/20 px-3 py-2" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}
