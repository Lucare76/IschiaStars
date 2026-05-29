"use client";

import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { useState } from "react";
import { adminApiHeaders } from "@/lib/admin-api-client";

export function HotelCreateForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <form
      className="rounded-2xl bg-white/90 p-5 shadow-soft"
      onSubmit={(event) => {
        event.preventDefault();
        setLoading(true);
        setMessage(null);
        const formData = new FormData(event.currentTarget);
        const services = String(formData.get("standardServices") ?? "")
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean);

        void fetch("/api/hotels", {
          method: "POST",
          headers: adminApiHeaders(),
          body: JSON.stringify({
            name: formData.get("name"),
            location: formData.get("location"),
            stars: Number(formData.get("stars") ?? 3),
            standardServices: services,
            paymentPolicy: formData.get("paymentPolicy"),
            cancellationPolicy: formData.get("cancellationPolicy"),
            shortDescription: formData.get("shortDescription")
          })
        })
          .then(async (response) => {
            const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; source?: string } | null;
            if (!response.ok || !payload?.ok) throw new Error(payload?.error ?? "Hotel non salvato");
            setMessage("Hotel salvato. Aggiorna la pagina per vederlo in elenco.");
          })
          .catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Errore salvataggio hotel"))
          .finally(() => setLoading(false));
      }}
    >
      <h2 className="text-xl font-black text-ischia-navy">Nuovo hotel</h2>
      <p className="mt-1 text-sm text-ischia-ink/68">Inserimento minimo per aggiungere una nuova struttura.</p>
      {message ? <p className="mt-3 rounded-xl bg-ischia-mist p-3 text-sm font-semibold text-ischia-navy">{message}</p> : null}
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <Input name="name" label="Nome hotel" required />
        <Input name="location" label="Localita" required />
        <Input name="stars" label="Stelle" type="number" required defaultValue="4" />
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Textarea name="standardServices" label="Servizi inclusi standard" defaultValue={"Assistenza IschiaStars\nWi-Fi\nPiscina o area relax"} />
        <Textarea name="shortDescription" label="Descrizione breve" />
        <Textarea name="paymentPolicy" label="Policy pagamento" />
        <Textarea name="cancellationPolicy" label="Policy cancellazione" />
      </div>
      <button className="mt-4 rounded-full bg-ischia-navy px-5 py-3 text-sm font-black text-white disabled:opacity-60" disabled={loading} type="submit">
        {loading ? "Salvataggio..." : "Salva hotel"}
      </button>
    </form>
  );
}

function Input({ label, ...props }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="text-sm font-semibold text-ischia-ink">
      {label}
      <input className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2" {...props} />
    </label>
  );
}

function Textarea({ label, ...props }: { label: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="text-sm font-semibold text-ischia-ink">
      {label}
      <textarea className="mt-1 min-h-24 w-full rounded-xl border border-ischia-blue/20 px-3 py-2" {...props} />
    </label>
  );
}
