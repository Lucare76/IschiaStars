"use client";

import { useMemo, useState } from "react";

type AmountKey = "sale" | "trainOut" | "trainBack" | "transfer";

const initialAmounts: Record<AmountKey, string> = {
  sale: "",
  trainOut: "",
  trainBack: "",
  transfer: ""
};

export function ZupponeCalculator() {
  const [amounts, setAmounts] = useState(initialAmounts);

  const result = useMemo(() => {
    const sale = parseAmount(amounts.sale);
    const trainOut = parseAmount(amounts.trainOut);
    const trainBack = parseAmount(amounts.trainBack);
    const transfer = parseAmount(amounts.transfer);

    const totalCosts = trainOut + trainBack + transfer;
    const profit = sale - totalCosts;
    const positiveProfit = Math.max(profit, 0);

    const distributableProfit = roundToHalf(positiveProfit);
    const diegoShare = roundToHalf(distributableProfit * 0.65);
    const iceShare = roundToHalf(distributableProfit - diegoShare);

    return {
      sale,
      totalCosts,
      profit,
      distributableProfit,
      diegoShare,
      iceShare
    };
  }, [amounts]);

  function updateAmount(key: AmountKey, value: string) {
    setAmounts((current) => ({ ...current, [key]: value }));
  }

  function reset() {
    setAmounts(initialAmounts);
  }

  const hasValues = Object.values(amounts).some((value) => value.trim() !== "");

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="rounded-2xl bg-white/95 p-5 shadow-soft sm:p-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-ischia-blue/70">Dati pratica</p>
          <h2 className="mt-1 text-xl font-black text-ischia-navy">Inserisci gli importi</h2>
          <p className="mt-2 text-sm leading-6 text-ischia-ink/65">
            Il guadagno è dato dal costo vendita meno treno andata, treno ritorno e trasferimento.
          </p>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <AmountInput label="Costo vendita" value={amounts.sale} onChange={(value) => updateAmount("sale", value)} />
          <AmountInput label="Costo treno andata" value={amounts.trainOut} onChange={(value) => updateAmount("trainOut", value)} />
          <AmountInput label="Costo treno ritorno" value={amounts.trainBack} onChange={(value) => updateAmount("trainBack", value)} />
          <AmountInput label="Costo trasferimento" value={amounts.transfer} onChange={(value) => updateAmount("transfer", value)} />
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            className="rounded-full bg-white px-4 py-2 text-sm font-black text-ischia-navy ring-1 ring-ischia-blue/20 transition hover:bg-ischia-mist"
            onClick={reset}
            type="button"
          >
            Azzera
          </button>
        </div>
      </section>

      <aside className="space-y-4">
        <div className="rounded-2xl bg-ischia-navy p-5 text-white shadow-soft sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/60">Riepilogo</p>

          <div className="mt-4 space-y-3">
            <SummaryRow label="Costo vendita" value={formatCurrency(result.sale)} />
            <SummaryRow label="Totale costi" value={formatCurrency(result.totalCosts)} />
          </div>

          <div className="my-5 border-t border-white/15" />

          <div>
            <p className="text-sm font-bold text-white/70">Guadagno</p>
            <p className={`mt-1 text-3xl font-black ${result.profit >= 0 ? "text-ischia-sand" : "text-red-300"}`}>
              {formatCurrency(result.profit)}
            </p>
            {result.profit > 0 && Math.abs(result.profit - result.distributableProfit) >= 0.001 ? (
              <p className="mt-2 text-xs leading-5 text-white/60">
                Importo da ripartire arrotondato a 0,50 €: {formatCurrency(result.distributableProfit)}
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <ShareCard label="Diego" percent="65%" value={result.diegoShare} />
          <ShareCard label="Ice" percent="35%" value={result.iceShare} />
        </div>

        {hasValues && result.profit <= 0 ? (
          <div className="rounded-2xl bg-amber-50 p-4 text-sm font-semibold text-amber-900 ring-1 ring-amber-200">
            Non c&apos;è un guadagno positivo da ripartire. Controlla gli importi inseriti.
          </div>
        ) : null}
      </aside>
    </div>
  );
}

function AmountInput({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-bold text-ischia-ink">
      {label}
      <div className="mt-1 flex items-center rounded-xl border border-ischia-blue/20 bg-white px-3 focus-within:border-ischia-blue">
        <span className="mr-2 font-black text-ischia-blue">€</span>
        <input
          className="min-w-0 flex-1 bg-transparent py-3 text-base font-semibold text-ischia-ink outline-none"
          inputMode="decimal"
          min="0"
          placeholder="0,00"
          step="0.01"
          type="number"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </label>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-white/70">{label}</span>
      <strong className="text-base text-white">{value}</strong>
    </div>
  );
}

function ShareCard({ label, percent, value }: { label: string; percent: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white/95 p-5 shadow-soft ring-1 ring-ischia-blue/10">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-ischia-blue/70">{label}</p>
          <p className="mt-1 text-sm font-bold text-ischia-ink/65">Quota {percent}</p>
        </div>
        <p className="text-2xl font-black text-ischia-navy">{formatCurrency(value)}</p>
      </div>
    </div>
  );
}

function parseAmount(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundToHalf(value: number) {
  return Math.round((value + Number.EPSILON) * 2) / 2;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}
