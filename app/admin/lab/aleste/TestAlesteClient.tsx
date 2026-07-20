"use client";

import { FormEvent, useMemo, useState } from "react";
import { adminApiFetch } from "@/lib/admin-api-client";
import type { AlestePublicTestResponse } from "@/lib/integrations/aleste-public";

type TestState =
  | { type: "idle" }
  | { type: "loading" }
  | { type: "done"; data: AlestePublicTestResponse }
  | { type: "error"; message: string };

export function TestAlesteClient() {
  const [destination, setDestination] = useState("ISCHIA (Isola)");
  const [checkIn, setCheckIn] = useState("2026-08-30");
  const [checkOut, setCheckOut] = useState("2026-09-06");
  const [adults, setAdults] = useState(2);
  const [rooms, setRooms] = useState(1);
  const [childrenAgesText, setChildrenAgesText] = useState("");
  const [state, setState] = useState<TestState>({ type: "idle" });

  const childrenAges = useMemo(() => parseChildrenAges(childrenAgesText), [childrenAgesText]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ type: "loading" });

    try {
      const response = await adminApiFetch("/api/admin/lab/aleste", {
        method: "POST",
        body: JSON.stringify({ destination, checkIn, checkOut, adults, rooms, childrenAges })
      });
      const payload = await response.json().catch(() => null) as (AlestePublicTestResponse & { error?: string }) | null;
      if (!response.ok || !payload?.ok) {
        setState({ type: "error", message: payload?.error ?? payload?.errors?.[0] ?? "Test Aleste non riuscito" });
        return;
      }
      setState({ type: "done", data: payload });
    } catch {
      setState({ type: "error", message: "Errore di rete durante il test Aleste" });
    }
  }

  return (
    <div className="grid gap-5">
      <div className="rounded-2xl bg-amber-50 p-4 text-sm font-black text-amber-900 shadow-soft ring-1 ring-amber-200">
        Laboratorio tecnico: nessuna disponibilità viene bloccata e nessuna prenotazione viene effettuata.
      </div>

      <form className="rounded-2xl bg-white/90 p-5 shadow-soft" onSubmit={handleSubmit}>
        <div className="grid gap-4 lg:grid-cols-3">
          <label className="block text-sm font-bold text-ischia-navy">
            Destinazione
            <input className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2 text-ischia-ink" value={destination} onChange={(event) => setDestination(event.target.value)} />
          </label>
          <label className="block text-sm font-bold text-ischia-navy">
            Check-in
            <input className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2 text-ischia-ink" type="date" value={checkIn} onChange={(event) => setCheckIn(event.target.value)} />
          </label>
          <label className="block text-sm font-bold text-ischia-navy">
            Check-out
            <input className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2 text-ischia-ink" type="date" value={checkOut} onChange={(event) => setCheckOut(event.target.value)} />
          </label>
          <label className="block text-sm font-bold text-ischia-navy">
            Adulti
            <input className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2 text-ischia-ink" min={1} max={6} type="number" value={adults} onChange={(event) => setAdults(Number(event.target.value))} />
          </label>
          <label className="block text-sm font-bold text-ischia-navy">
            Bambini / età
            <input className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2 text-ischia-ink" placeholder="es. 8, 12" value={childrenAgesText} onChange={(event) => setChildrenAgesText(event.target.value)} />
          </label>
          <label className="block text-sm font-bold text-ischia-navy">
            Camere
            <input className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2 text-ischia-ink" min={1} max={3} type="number" value={rooms} onChange={(event) => setRooms(Number(event.target.value))} />
          </label>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button className="rounded-full bg-ischia-navy px-5 py-2 text-sm font-black text-white disabled:opacity-60" disabled={state.type === "loading"} type="submit">
            {state.type === "loading" ? "Test in corso..." : "Esegui test"}
          </button>
          <p className="text-xs font-semibold text-ischia-ink/60">Solo server-side, senza salvataggio database.</p>
        </div>
      </form>

      {state.type === "error" ? <StatusBox tone="error" message={state.message} /> : null}
      {state.type === "done" ? <Results data={state.data} /> : null}
    </div>
  );
}

function Results({ data }: { data: AlestePublicTestResponse }) {
  return (
    <div className="grid gap-4">
      <section className="rounded-2xl bg-white/90 p-5 shadow-soft">
        <div className="grid gap-3 text-sm md:grid-cols-6">
          <Info label="Durata" value={`${data.durationMs} ms`} />
          <Info label="Cache" value={data.cached ? "Sì" : "No"} />
          <Info label="Sorgente" value={formatProductSource(data.technical.productSource)} />
          <Info label="Prodotti trovati" value={String(data.technical.productsFound ?? data.technical.productsChecked)} />
          <Info label="Prodotti testati" value={String(data.technical.productsChecked)} />
          <Info label="Controllato il" value={formatDateTime(data.checkedAt)} />
        </div>
        <div className="mt-4 rounded-xl bg-ischia-sky/40 p-3 text-xs font-semibold text-ischia-ink/70">
          Parametri inviati: destinazione {data.params.destination}, {data.params.checkIn} - {data.params.checkOut}, gruppi {data.params.groups}
        </div>
        {data.warnings.length ? <MessageList title="Avvisi" items={data.warnings} /> : null}
        {data.errors.length ? <MessageList title="Errori" items={data.errors} tone="error" /> : null}
      </section>

      <section className="grid gap-3">
        {data.results.length ? data.results.map((result, index) => (
          <article key={`${result.productCode ?? "product"}-${index}`} className="rounded-2xl bg-white/90 p-5 shadow-soft">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-lg font-black text-ischia-navy">{result.hotelName}</p>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-ischia-blue/70">{result.productCode ?? "ProductCode non recuperato"}</p>
              </div>
              <div className="rounded-xl bg-ischia-sky/60 px-3 py-2 text-right text-sm font-black text-ischia-navy">
                {result.totalPrice != null ? formatCurrency(result.totalPrice) : "Prezzo non recuperato"}
              </div>
            </div>
            <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
              <Info label="Soggiorno" value={`${result.checkIn} - ${result.checkOut} (${result.nights} notti)`} />
              <Info label="Occupazione" value={`${result.rooms} camere, ${result.adults} adulti${result.childrenAges.length ? `, bambini ${result.childrenAges.join(", ")}` : ""}`} />
              <Info label="Disponibilità" value={result.availabilityStatus ?? "Non recuperata"} />
              <Info label="Camera" value={result.roomName || "Non recuperata"} />
              <Info label="Trattamento" value={result.boardName || "Non recuperato"} />
              <Info label="OfferId" value={result.maskedOfferId ?? "Non presente"} />
            </div>
            {result.supplements.length ? <DetailList title="Supplementi" items={result.supplements} /> : null}
            {result.reductions.length ? <DetailList title="Riduzioni" items={result.reductions} /> : null}
            {result.missingFields.length ? <p className="mt-3 text-xs font-semibold text-amber-700">Campi mancanti: {result.missingFields.join(", ")}</p> : null}
            <a className="mt-3 inline-block break-all text-xs font-bold text-ischia-blue underline" href={result.sourceUrl} rel="noopener noreferrer" target="_blank">
              Link pubblico originale
            </a>
          </article>
        )) : (
          <div className="rounded-2xl bg-white/90 p-5 text-sm font-semibold text-ischia-ink/70 shadow-soft">Nessun risultato normalizzato.</div>
        )}
      </section>
    </div>
  );
}

function StatusBox({ message, tone = "default" }: { message: string; tone?: "default" | "error" }) {
  return <div className={`rounded-2xl p-5 text-sm font-semibold shadow-soft ${tone === "error" ? "bg-red-50 text-red-800 ring-1 ring-red-200" : "bg-white/90 text-ischia-ink/70"}`}>{message}</div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-ischia-sky/40 p-3">
      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-ischia-blue/75">{label}</p>
      <p className="mt-1 break-words font-bold text-ischia-navy">{value}</p>
    </div>
  );
}

function MessageList({ title, items, tone = "default" }: { title: string; items: string[]; tone?: "default" | "error" }) {
  return (
    <div className={`mt-4 rounded-xl p-3 text-sm font-semibold ${tone === "error" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-800"}`}>
      <p className="font-black">{title}</p>
      <ul className="mt-2 list-disc pl-5">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}

function DetailList({ title, items }: { title: string; items: { name: string; price: number | null }[] }) {
  return (
    <div className="mt-3 text-sm">
      <p className="font-black text-ischia-navy">{title}</p>
      <ul className="mt-1 list-disc pl-5 text-ischia-ink/75">
        {items.map((item, index) => <li key={`${item.name}-${index}`}>{item.name}{item.price != null ? `: ${formatCurrency(item.price)}` : ""}</li>)}
      </ul>
    </div>
  );
}

function parseChildrenAges(value: string) {
  return value
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((age) => Number.isFinite(age));
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(value);
}

function formatProductSource(value?: string) {
  if (value === "search_results") return "Risultati";
  if (value === "catalog_grid") return "Catalogo";
  if (value === "autocomplete") return "Autocomplete";
  return "Non indicata";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "medium" }).format(new Date(value));
}
