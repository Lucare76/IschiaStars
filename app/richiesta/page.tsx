"use client";

import { useEffect, useRef, useState } from "react";
import { IschiaStarsLogo } from "@/components/IschiaStarsLogo";

const TRATTAMENTI = ["B&B", "Mezza pensione", "Pensione completa", "All inclusive", "Solo alloggio"];
const ZONE = ["Ischia", "Ischia Porto", "Ischia Ponte", "Forio", "Lacco Ameno", "Casamicciola", "Barano", "Sant'Angelo"];

type Child = { age: string };

type Form = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  checkIn: string;
  checkOut: string;
  adults: string;
  rooms: string;
  numChildren: string;
  children: Child[];
  requestedHotel: string;
  treatment: string;
  destination: string;
  message: string;
};

const empty: Form = {
  firstName: "", lastName: "", email: "", phone: "",
  checkIn: "", checkOut: "",
  adults: "2", rooms: "1",
  numChildren: "0", children: [],
  requestedHotel: "", treatment: "B&B", destination: "Ischia",
  message: ""
};

export default function RichiestaPreventivo() {
  const [form, setForm] = useState<Form>(empty);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const messageTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    resizeTextarea(messageTextareaRef.current);
  }, [form.message]);

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setChildCount(n: number) {
    const current = form.children;
    const updated = n > current.length
      ? [...current, ...Array.from({ length: n - current.length }, () => ({ age: "" }))]
      : current.slice(0, n);
    setForm((prev) => ({ ...prev, numChildren: String(n), children: updated }));
  }

  function setChildAge(index: number, value: string) {
    setForm((prev) => ({
      ...prev,
      children: prev.children.map((c, i) => i === index ? { age: value } : c)
    }));
  }

  const canSubmit = form.firstName && form.lastName && (form.email || form.phone) && form.checkIn && form.checkOut
    && (form.children.length === 0 || form.children.every((c) => c.age !== ""));

  async function submit() {
    setLoading(true);
    setError(null);

    const res = await fetch("/api/richiesta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        checkIn: form.checkIn,
        checkOut: form.checkOut,
        adults: Number(form.adults),
        rooms: Number(form.rooms),
        children: form.children.map((c) => ({ age: Number(c.age) })),
        requestedHotel: form.requestedHotel || undefined,
        treatment: form.treatment || undefined,
        destination: form.destination,
        message: form.message || undefined
      })
    });

    const result = await res.json().catch(() => null) as { ok?: boolean; error?: string } | null;
    setLoading(false);

    if (!res.ok || !result?.ok) {
      setError(result?.error ?? "Invio non riuscito. Riprova o chiamaci direttamente.");
      return;
    }

    setSubmitted(true);
  }

  if (submitted) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-ischia-mist px-3 py-8 sm:px-5 sm:py-12">
        <div className="w-full max-w-lg text-center">
          <IschiaStarsLogo />
          <div className="mt-6 rounded-[22px] bg-white p-5 shadow-soft sm:mt-8 sm:rounded-[28px] sm:p-8">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl">✓</div>
            <h1 className="mt-5 text-2xl font-black text-ischia-navy">Richiesta inviata!</h1>
            <p className="mt-3 text-ischia-ink/75">Grazie {form.firstName}, abbiamo ricevuto la tua richiesta. Ti risponderemo entro 24 ore con una proposta personalizzata.</p>
            <p className="mt-5 rounded-xl bg-ischia-mist px-4 py-3 text-sm font-semibold text-ischia-navy">
              Per urgenze: WhatsApp <strong>371 75 90 017</strong> · Tel <strong>081 90 54 81</strong>
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-ischia-mist px-3 py-4 sm:px-5 sm:py-8">
      <div className="mx-auto max-w-2xl">
        <IschiaStarsLogo />

        <div className="mt-5 overflow-hidden rounded-[22px] bg-white shadow-soft sm:mt-6 sm:rounded-[28px]">
          <div className="brand-shell p-5 text-white sm:p-9">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-ischia-sand">IschiaStars</p>
            <h1 className="mt-2 text-2xl font-black leading-tight sm:text-4xl">Richiedi il tuo preventivo</h1>
            <p className="mt-3 max-w-md text-white/80">Compila il modulo e riceverai una proposta personalizzata entro 24 ore, senza impegno.</p>
          </div>

          <div className="space-y-6 p-4 sm:space-y-7 sm:p-9">

            {/* Dati personali */}
            <section>
              <SectionTitle>I tuoi dati</SectionTitle>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nome *" value={form.firstName} onChange={(v) => set("firstName", v)} autoComplete="given-name" />
                <Field label="Cognome *" value={form.lastName} onChange={(v) => set("lastName", v)} autoComplete="family-name" />
                <Field label="Email" type="email" value={form.email} onChange={(v) => set("email", v)} autoComplete="email" />
                <Field label="Telefono" type="tel" value={form.phone} onChange={(v) => set("phone", v)} autoComplete="tel" />
              </div>
              <p className="mt-2 text-xs text-ischia-ink/55">* Inserisci almeno un contatto tra email e telefono.</p>
            </section>

            {/* Date e ospiti */}
            <section>
              <SectionTitle>Soggiorno</SectionTitle>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Data arrivo *" type="date" value={form.checkIn} onChange={(v) => set("checkIn", v)} />
                <Field label="Data partenza *" type="date" value={form.checkOut} onChange={(v) => set("checkOut", v)} />
                <Field label="Adulti" type="number" value={form.adults} onChange={(v) => set("adults", v)} min={1} max={20} />
                <Field label="Camere" type="number" value={form.rooms} onChange={(v) => set("rooms", v)} min={1} max={10} />
              </div>

              <div className="mt-3">
                <Select
                  label="Bambini"
                  value={form.numChildren}
                  onChange={(v) => setChildCount(Number(v))}
                  options={["0", "1", "2", "3", "4", "5"].map((n) => ({
                    value: n,
                    label: n === "0" ? "Nessun bambino" : `${n} ${n === "1" ? "bambino" : "bambini"}`
                  }))}
                />
              </div>

              {form.children.length > 0 && (
                <div className="mt-3 space-y-2 rounded-xl bg-ischia-mist p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-ischia-blue">Età bambini</p>
                  {form.children.map((child, i) => (
                    <Field
                      key={i}
                      label={`Bambino ${i + 1} — Età *`}
                      type="number"
                      value={child.age}
                      onChange={(v) => setChildAge(i, v)}
                      min={0}
                      max={17}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Preferenze hotel */}
            <section>
              <SectionTitle>Preferenze</SectionTitle>
              <div className="grid gap-3">
                <Select
                  label="Zona preferita"
                  value={form.destination}
                  onChange={(v) => set("destination", v)}
                  options={ZONE.map((z) => ({ value: z, label: z }))}
                />
                <Field
                  label="Hotel desiderato (se hai già una preferenza)"
                  value={form.requestedHotel}
                  onChange={(v) => set("requestedHotel", v)}
                  placeholder="Es. Hotel Terme Manzi, o lascia vuoto"
                />
                <Select
                  label="Trattamento"
                  value={form.treatment}
                  onChange={(v) => set("treatment", v)}
                  options={TRATTAMENTI.map((t) => ({ value: t, label: t }))}
                />
                <label className="flex flex-col gap-1 text-sm font-semibold text-ischia-ink">
                  Note aggiuntive
                  <textarea
                    className="min-h-24 resize-y overflow-hidden whitespace-pre-wrap break-words rounded-xl border border-ischia-blue/20 px-3 py-2 text-sm font-normal leading-6"
                    value={form.message}
                    onChange={(e) => set("message", e.target.value)}
                    onInput={(event) => resizeTextarea(event.currentTarget)}
                    placeholder="Richieste speciali, allergie, esigenze particolari..."
                    ref={messageTextareaRef}
                    wrap="soft"
                  />
                </label>
              </div>
            </section>

            {error ? (
              <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>
            ) : null}

            <button
              className="min-h-12 w-full rounded-full bg-ischia-navy px-4 py-3 text-base font-black text-white disabled:opacity-50 sm:py-4"
              disabled={loading || !canSubmit}
              onClick={() => void submit()}
              type="button"
            >
              {loading ? "Invio in corso..." : "Invia richiesta di preventivo"}
            </button>

            <p className="text-center text-xs text-ischia-ink/45">
              I tuoi dati vengono utilizzati esclusivamente per rispondere alla tua richiesta e non saranno condivisi con terzi.
            </p>
          </div>
        </div>

        <p className="mt-5 px-2 text-center text-sm leading-relaxed text-ischia-ink/55 sm:mt-6">
          Preferisci chiamare? <strong className="text-ischia-navy">081 90 54 81</strong> · WhatsApp <strong className="text-ischia-navy">371 75 90 017</strong>
        </p>
      </div>
    </main>
  );
}

function resizeTextarea(element: HTMLTextAreaElement | null) {
  if (!element) return;
  element.style.height = "auto";
  element.style.height = `${Math.max(element.scrollHeight, 96)}px`;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 text-base font-black text-ischia-navy sm:text-lg">{children}</h2>;
}

function Field({
  label, value, onChange, type = "text", min, max, autoComplete, placeholder
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; min?: number; max?: number; autoComplete?: string; placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold text-ischia-ink">
      {label}
      <input
        className="min-h-11 rounded-xl border border-ischia-blue/20 px-3 py-2 font-normal"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={min}
        max={max}
        autoComplete={autoComplete}
        placeholder={placeholder}
      />
    </label>
  );
}

function Select({
  label, value, onChange, options
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold text-ischia-ink">
      {label}
      <select
        className="min-h-11 rounded-xl border border-ischia-blue/20 px-3 py-2 font-normal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}
