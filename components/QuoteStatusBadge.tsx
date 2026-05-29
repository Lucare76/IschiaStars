import { statusLabels } from "@/lib/mock-data";
import { QuoteStatus } from "@/lib/types";

type DisplayStatus = QuoteStatus | "aperto";

const statusClass: Record<DisplayStatus, string> = {
  da_evadere: "bg-ischia-sun/18 text-amber-800 ring-amber-200",
  in_lavorazione: "bg-ischia-aqua/15 text-ischia-navy ring-cyan-200",
  preventivo_inviato: "bg-blue-50 text-ischia-blue ring-blue-200",
  aperto: "bg-cyan-50 text-ischia-navy ring-cyan-200",
  confermato: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  perso_non_disponibile: "bg-rose-50 text-rose-700 ring-rose-200"
};

const displayLabels: Record<DisplayStatus, string> = {
  ...statusLabels,
  aperto: "Aperto"
};

export function QuoteStatusBadge({ status }: { status: DisplayStatus }) {
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1 ${statusClass[status]}`}>{displayLabels[status]}</span>;
}
