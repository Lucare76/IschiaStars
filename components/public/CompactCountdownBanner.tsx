"use client";

import { useEffect, useState } from "react";

function remainingParts(iso: string) {
  const total = Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60
  };
}

export function CompactCountdownBanner({
  offerExpiresAt,
  isConfirmed
}: {
  offerExpiresAt: string | null;
  isConfirmed: boolean;
}) {
  const [parts, setParts] = useState(() => offerExpiresAt ? remainingParts(offerExpiresAt) : null);

  useEffect(() => {
    if (!offerExpiresAt || isConfirmed) return;
    const update = () => setParts(remainingParts(offerExpiresAt));
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [offerExpiresAt, isConfirmed]);

  if (!offerExpiresAt || isConfirmed || !parts) return null;

  const items = [
    ["giorni", parts.days],
    ["ore", parts.hours],
    ["min", parts.minutes],
    ["sec", parts.seconds]
  ] as const;

  return (
    <div className="h-full rounded-[20px] bg-ischia-navy px-4 py-4 text-white shadow-[0_12px_28px_rgba(8,63,115,0.22)]">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/75">Questa proposta è valida ancora</p>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {items.map(([label, value]) => (
          <div key={label} className="rounded-xl bg-white/10 px-2 py-2 text-center ring-1 ring-white/10">
            <p className="text-xl font-black tabular-nums">{String(value).padStart(2, "0")}</p>
            <p className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.1em] text-ischia-sand">{label}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] leading-4 text-white/65">Disponibilità limitata — conferma la proposta che preferisci.</p>
    </div>
  );
}
