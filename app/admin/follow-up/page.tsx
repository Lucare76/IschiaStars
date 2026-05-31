import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";
import { FollowUpWhatsAppButton } from "@/components/FollowUpWhatsAppButton";
import { getFollowUpQuotes, FollowUpQuote, FollowUpSegment } from "@/lib/repositories/followUp";
import { formatDate, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

type FollowUpFilter = "tutti" | "mai_aperti" | "aperti_non_confermati" | "molto_interessati" | "da_sollecitare";

const filters: { value: FollowUpFilter; label: string }[] = [
  { value: "tutti", label: "Tutti" },
  { value: "mai_aperti", label: "Mai aperti" },
  { value: "aperti_non_confermati", label: "Aperti non confermati" },
  { value: "molto_interessati", label: "Molto interessati" },
  { value: "da_sollecitare", label: "Da sollecitare" }
];

export default async function FollowUpPage({ searchParams }: { searchParams?: { filter?: string } }) {
  const activeFilter = normalizeFilter(searchParams?.filter);
  const followUpResult = await getFollowUpQuotes();
  const quotes = followUpResult.data;
  const visibleQuotes = quotes.filter((quote) => matchesFilter(quote, activeFilter));

  const stats = {
    total: quotes.length,
    neverOpened: quotes.filter((quote) => quote.segment === "mai_aperto").length,
    opened: quotes.filter((quote) => quote.openedCount > 0).length,
    veryInterested: quotes.filter((quote) => quote.segment === "molto_interessato").length
  };

  return (
    <AdminShell title="Da richiamare" subtitle="Preventivi caldi da recuperare: clienti che hanno ricevuto o aperto la proposta ma non hanno ancora confermato.">
      <section className="grid gap-4 md:grid-cols-4">
        <Kpi label="Preventivi da richiamare" value={stats.total} />
        <Kpi label="Mai aperti" value={stats.neverOpened} />
        <Kpi label="Aperti non confermati" value={stats.opened} />
        <Kpi label="Molto interessati" value={stats.veryInterested} />
      </section>

      <nav className="mt-6 flex flex-wrap gap-2">
        {filters.map((filter) => (
          <Link
            key={filter.value}
            className={`rounded-full px-4 py-2 text-sm font-bold ring-1 transition ${
              activeFilter === filter.value
                ? "bg-ischia-navy text-white ring-ischia-navy"
                : "bg-white text-ischia-navy ring-slate-200 hover:bg-ischia-blue/10"
            }`}
            href={`/admin/follow-up?filter=${filter.value}`}
          >
            {filter.label}
          </Link>
        ))}
      </nav>

      {followUpResult.error ? (
        <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 ring-1 ring-amber-200">
          Dati caricati in fallback: {followUpResult.error}
        </p>
      ) : null}

      <section className="mt-6 grid gap-4">
        {visibleQuotes.length === 0 ? (
          <div className="rounded-2xl bg-white p-6 text-ischia-ink/70 ring-1 ring-slate-200">Nessun preventivo in questa lista.</div>
        ) : (
          visibleQuotes.map((quote) => <FollowUpCard key={quote.id} quote={quote} />)
        )}
      </section>
    </AdminShell>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
      <p className="text-sm font-bold text-ischia-ink/60">{label}</p>
      <p className="mt-2 text-3xl font-black text-ischia-navy">{value}</p>
    </div>
  );
}

function FollowUpCard({ quote }: { quote: FollowUpQuote }) {
  return (
    <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${segmentClass(quote.segment)}`}>{quote.segmentLabel}</span>
            <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${priorityClass(quote.priority)}`}>Priorità {quote.priority}</span>
            {quote.expiresSoon ? <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black uppercase text-amber-800">Scadenza vicina</span> : null}
          </div>
          <h2 className="mt-3 text-2xl font-black text-ischia-navy">{quote.clientName}</h2>
          <p className="mt-1 text-sm font-semibold text-ischia-ink/65">
            {quote.code} · inviato {formatDate(quote.sentAt)}
          </p>
          <p className="mt-3 text-sm text-ischia-ink/75">
            {quote.clientPhone || "Telefono assente"} · {quote.clientEmail || "Email assente"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <a className="rounded-full bg-ischia-navy px-4 py-2 text-sm font-bold text-white transition hover:bg-ischia-blue" href={quote.publicUrl} rel="noreferrer" target="_blank">
            Apri preventivo
          </a>
          <FollowUpWhatsAppButton href={quote.whatsappHref} quoteCode={quote.code} token={quote.token} segment={quote.segment} clientPhone={quote.clientPhone} />
        </div>
      </div>

      <div className="mt-5 grid gap-3 text-sm md:grid-cols-4">
        <Info label="Ultimo evento" value={quote.lastEventAt ? `${quote.lastEventLabel} · ${formatDateTime(quote.lastEventAt)}` : quote.lastEventLabel} />
        <Info label="Aperture" value={String(quote.openedCount)} />
        <Info label="Click WhatsApp" value={String(quote.whatsappClickCount)} />
        <Info label="Click hotel / PDF" value={`${quote.hotelLinkClickCount} / ${quote.printClickCount}`} />
      </div>

      <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
        <Info label="Hotel proposti" value={quote.hotelsSummary || "Non indicati"} />
        <Info label="Offerta principale" value={quote.mainOffer} />
      </div>
    </article>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3">
      <p className="text-xs font-black uppercase text-ischia-ink/45">{label}</p>
      <p className="mt-1 font-bold text-ischia-navy">{value}</p>
    </div>
  );
}

function normalizeFilter(value?: string): FollowUpFilter {
  return filters.some((filter) => filter.value === value) ? value as FollowUpFilter : "tutti";
}

function matchesFilter(quote: FollowUpQuote, filter: FollowUpFilter) {
  if (filter === "tutti") return true;
  if (filter === "mai_aperti") return quote.segment === "mai_aperto";
  if (filter === "aperti_non_confermati") return quote.openedCount > 0;
  if (filter === "molto_interessati") return quote.segment === "molto_interessato";
  return quote.segment === "da_sollecitare";
}

function segmentClass(segment: FollowUpSegment) {
  const classes: Record<FollowUpSegment, string> = {
    mai_aperto: "bg-slate-100 text-slate-700",
    aperto_non_confermato: "bg-sky-100 text-sky-800",
    molto_interessato: "bg-emerald-100 text-emerald-800",
    da_sollecitare: "bg-amber-100 text-amber-800",
    recente: "bg-indigo-100 text-indigo-800"
  };
  return classes[segment];
}

function priorityClass(priority: FollowUpQuote["priority"]) {
  return priority === "alta" ? "bg-red-100 text-red-800" : priority === "media" ? "bg-orange-100 text-orange-800" : "bg-slate-100 text-slate-700";
}
