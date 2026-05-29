"use client";

import { useState } from "react";
import { hotels } from "@/lib/mock-data";

export function ServicesPolicyEditor() {
  const hotel = hotels[0];
  const [services, setServices] = useState(hotel.standardServices.join("\n"));
  const [paymentPolicy, setPaymentPolicy] = useState(hotel.paymentPolicy);
  const [cancellationPolicy, setCancellationPolicy] = useState(hotel.cancellationPolicy);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-ischia-sun/20 p-4 text-sm font-semibold text-ischia-navy ring-1 ring-ischia-sun/35">
        Area template locale: questi testi servono come riferimento operativo in questa schermata. I servizi e le policy realmente usati nei preventivi si aggiornano dalla scheda Hotel / strutture o dal singolo preventivo.
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <EditorField label="Servizi inclusi" value={services} onChange={setServices} />
        <EditorField label="Policy pagamento" value={paymentPolicy} onChange={setPaymentPolicy} />
        <EditorField label="Policy cancellazione" value={cancellationPolicy} onChange={setCancellationPolicy} />
      </div>
    </div>
  );
}

function EditorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block rounded-2xl bg-white/90 p-5 shadow-soft">
      <span className="text-sm font-bold uppercase tracking-[0.14em] text-ischia-blue">{label}</span>
      <textarea className="focus-ring mt-3 min-h-36 w-full rounded-xl border border-ischia-blue/20 bg-white p-3 text-sm leading-6" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
