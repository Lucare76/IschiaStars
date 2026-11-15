import { formatCurrency } from "@/lib/utils";
import type { getQuoteCostBreakdown } from "@/lib/confirmation-additional-services";

export function QuoteCostBreakdown({ breakdown }: { breakdown: ReturnType<typeof getQuoteCostBreakdown> | undefined }) {
  if (!breakdown) return null;
  return (
    <section className="rounded-2xl bg-white p-5 text-ischia-navy ring-1 ring-ischia-blue/15">
      <h3 className="text-lg font-black">Riepilogo costi della proposta scelta</h3>
      <dl className="mt-3 space-y-3 text-sm">
        <div className="flex justify-between gap-4"><dt>{breakdown.hasUnpricedServices ? "Soggiorno e servizi senza importo distinto" : "Soggiorno hotel"}</dt><dd className="shrink-0 font-bold">{formatCurrency(breakdown.accommodation)}</dd></div>
        {breakdown.services.map((service, index) => (
          <div key={index} className="flex justify-between gap-4"><dt>{service.label}</dt><dd className="shrink-0 font-bold">{service.cost != null ? formatCurrency(service.cost) : "Importo non specificato"}</dd></div>
        ))}
        <div className="flex justify-between gap-4 border-t border-ischia-blue/15 pt-3 text-base font-black"><dt>Totale complessivo</dt><dd className="shrink-0">{formatCurrency(breakdown.total)}</dd></div>
      </dl>
    </section>
  );
}
