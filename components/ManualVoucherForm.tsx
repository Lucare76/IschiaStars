"use client";

import { FormEvent, useState } from "react";
import { adminApiErrorMessage, adminApiFetch, readAdminApiJson } from "@/lib/admin-api-client";

type ManualVoucherPayload = {
  quoteCode: string;
  clientFullName: string;
  clientEmail: string;
  clientPhone: string;
  hotelName: string;
  roomTypeLabel: string;
  treatmentLabel: string;
  arrivalDate: string;
  departureDate: string;
  adults: string;
  children: string;
  includedServices: string;
  depositAmount: string;
  depositPaidAt: string;
  balanceAmount: string;
  balanceMethodLabel: string;
  cancellationPolicy: string;
  voucherNotes: string;
};

const today = new Date().toISOString().slice(0, 10);

const initialForm: ManualVoucherPayload = {
  quoteCode: "",
  clientFullName: "",
  clientEmail: "",
  clientPhone: "",
  hotelName: "",
  roomTypeLabel: "",
  treatmentLabel: "",
  arrivalDate: "",
  departureDate: "",
  adults: "2",
  children: "0",
  includedServices: "",
  depositAmount: "",
  depositPaidAt: today,
  balanceAmount: "",
  balanceMethodLabel: "Saldo da versare direttamente in struttura.",
  cancellationPolicy: "",
  voucherNotes: "",
};

export function ManualVoucherForm() {
  const [form, setForm] = useState<ManualVoucherPayload>(initialForm);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function updateField<K extends keyof ManualVoucherPayload>(field: K, value: ManualVoucherPayload[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    const response = await adminApiFetch("/api/vouchers/manual", {
      method: "POST",
      body: JSON.stringify(form),
    });

    if (!response.ok) {
      const result = await readAdminApiJson<{ error?: string }>(response);
      setMessage(adminApiErrorMessage(response, result, "Non è stato possibile generare il voucher."));
      setLoading(false);
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");

    const link = document.createElement("a");
    link.href = url;
    link.download = `voucher-${form.quoteCode.trim() || "manuale"}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => URL.revokeObjectURL(url), 30000);
    setMessage("Voucher generato. Si apre in una nuova scheda e viene scaricato come PDF.");
    setLoading(false);
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5">
      <section className="rounded-2xl bg-white/90 p-5 shadow-soft">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Codice voucher" value={form.quoteCode} onChange={(value) => updateField("quoteCode", value)} placeholder="Es. OLD-2024-018" />
          <Field label="Cliente" value={form.clientFullName} onChange={(value) => updateField("clientFullName", value)} placeholder="Nome e cognome" required />
          <Field label="Email" type="email" value={form.clientEmail} onChange={(value) => updateField("clientEmail", value)} placeholder="cliente@email.it" />
          <Field label="Telefono" value={form.clientPhone} onChange={(value) => updateField("clientPhone", value)} placeholder="+39..." />
          <Field label="Hotel" value={form.hotelName} onChange={(value) => updateField("hotelName", value)} placeholder="Nome struttura" required />
          <Field label="Camera" value={form.roomTypeLabel} onChange={(value) => updateField("roomTypeLabel", value)} placeholder="Es. Camera matrimoniale vista mare" />
          <Field label="Trattamento" value={form.treatmentLabel} onChange={(value) => updateField("treatmentLabel", value)} placeholder="Es. Mezza pensione" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Arrivo" type="date" value={form.arrivalDate} onChange={(value) => updateField("arrivalDate", value)} required />
            <Field label="Partenza" type="date" value={form.departureDate} onChange={(value) => updateField("departureDate", value)} required />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Adulti" type="number" min="0" value={form.adults} onChange={(value) => updateField("adults", value)} />
            <Field label="Bambini" type="number" min="0" value={form.children} onChange={(value) => updateField("children", value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Caparra versata" type="number" min="0" step="0.01" value={form.depositAmount} onChange={(value) => updateField("depositAmount", value)} placeholder="0,00" />
            <Field label="Data caparra" type="date" value={form.depositPaidAt} onChange={(value) => updateField("depositPaidAt", value)} />
          </div>
          <Field label="Saldo" type="number" min="0" step="0.01" value={form.balanceAmount} onChange={(value) => updateField("balanceAmount", value)} placeholder="Da lasciare vuoto se non serve" />
          <Field label="Modalità saldo" value={form.balanceMethodLabel} onChange={(value) => updateField("balanceMethodLabel", value)} />
        </div>
      </section>

      <section className="rounded-2xl bg-white/90 p-5 shadow-soft">
        <div className="grid gap-4 md:grid-cols-2">
          <Textarea
            label="Servizi inclusi"
            value={form.includedServices}
            onChange={(value) => updateField("includedServices", value)}
            placeholder="Uno per riga: spiaggia inclusa, transfer, bevande..."
          />
          <Textarea
            label="Note voucher"
            value={form.voucherNotes}
            onChange={(value) => updateField("voucherNotes", value)}
            placeholder="Richieste cliente, orari, dettagli da mostrare nel PDF..."
          />
          <div className="md:col-span-2">
            <Textarea
              label="Policy cancellazione"
              value={form.cancellationPolicy}
              onChange={(value) => updateField("cancellationPolicy", value)}
              placeholder="Condizioni o penali da riportare nel voucher."
            />
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-ischia-navy px-5 py-3 text-sm font-black text-white shadow-soft transition hover:bg-ischia-blue disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Genero il PDF..." : "Genera voucher PDF"}
        </button>
        {message ? <p className="text-sm font-semibold text-ischia-ink/70">{message}</p> : null}
      </div>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  placeholder,
  min,
  step,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  min?: string;
  step?: string;
}) {
  return (
    <label className="block text-sm font-bold text-ischia-navy">
      {label}
      <input
        className="mt-1 w-full rounded-xl border border-ischia-blue/15 bg-white px-3 py-2.5 text-sm font-semibold text-ischia-ink outline-none transition focus:border-ischia-blue focus:ring-2 focus:ring-ischia-blue/15"
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        min={min}
        step={step}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function Textarea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm font-bold text-ischia-navy">
      {label}
      <textarea
        className="mt-1 min-h-32 w-full rounded-xl border border-ischia-blue/15 bg-white px-3 py-2.5 text-sm font-semibold text-ischia-ink outline-none transition focus:border-ischia-blue focus:ring-2 focus:ring-ischia-blue/15"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
