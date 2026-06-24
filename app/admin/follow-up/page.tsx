import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";
import { FollowUpActionButtons } from "@/components/FollowUpActionButtons";
import { FollowUpWhatsAppButton } from "@/components/FollowUpWhatsAppButton";
import { followUpGroupSegment, getDueFollowUpCustomerKeys, getFollowUpQuotes, FollowUpEmailInfo, FollowUpHotelClick, FollowUpQuote, FollowUpSegment } from "@/lib/repositories/followUp";
import { followUpCustomerKey, isFollowUpStageDue } from "@/lib/follow-up-policy";
import { formatDate, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type FollowUpFilter = "caldi" | "da_sollecitare" | "non_visualizzati" | "gia_richiamati" | "storici" | "chiusi" | "tutti";

const filters: { value: FollowUpFilter; label: string }[] = [
  { value: "caldi", label: "Caldi" },
  { value: "da_sollecitare", label: "Da sollecitare" },
  { value: "non_visualizzati", label: "Non visualizzati" },
  { value: "gia_richiamati", label: "Già sollecitati" },
  { value: "storici", label: "Tracking storico" },
  { value: "chiusi", label: "Chiusi" },
  { value: "tutti", label: "Tutti" }
];

type FollowUpGroup = {
  key: string;
  primary: FollowUpQuote;
  quotes: FollowUpQuote[];
  totalOpenings: number;
  totalWhatsappClicks: number;
  totalHotelClicks: number;
  totalPrints: number;
  totalConfirmClicks: number;
  hotelClicks: FollowUpHotelClick[];
  engagementScore: number;
  segment: FollowUpSegment;
  segmentLabel: string;
  priority: FollowUpQuote["priority"];
  lastEventAt?: string;
  lastEventLabel: string;
  lastFollowUpAt?: string;
  snoozedUntil?: string;
  staySummary: string;
  isSnoozed: boolean;
  isContactDue: boolean;
  emailInfo: FollowUpEmailInfo;
};

export default async function FollowUpPage({ searchParams }: { searchParams?: { filter?: string } }) {
  const activeFilter = normalizeFilter(searchParams?.filter);
  const followUpResult = await getFollowUpQuotes();

  if (followUpResult.source !== "supabase") {
    return (
      <AdminShell title="Follow-up" subtitle="Clienti da recuperare ordinati per segnali reali: aperture, click hotel, WhatsApp cliente e conferma.">
        <DataUnavailable error={followUpResult.error} />
      </AdminShell>
    );
  }

  const quotes = followUpResult.data;
  const dueCustomerKeys = getDueFollowUpCustomerKeys(quotes);
  const groups = groupFollowUps(quotes);
  const visibleGroups = groups.filter((group) => matchesFilter(group, activeFilter, dueCustomerKeys));

  const stats = {
    hot: groups.filter((group) => group.priority === "alta" && !group.lastFollowUpAt && !group.isSnoozed).length,
    toSolicit: groups.filter((group) => group.segment === "da_sollecitare" && !group.lastFollowUpAt && !group.isSnoozed).length,
    neverOpened: dueCustomerKeys.size,
    contacted: groups.filter((group) => Boolean(group.lastFollowUpAt)).length
  };

  return (
    <AdminShell title="Follow-up" subtitle="Clienti da recuperare ordinati per segnali reali: aperture, click hotel, WhatsApp cliente e conferma.">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Clienti caldi" value={stats.hot} />
        <Kpi label="Da sollecitare" value={stats.toSolicit} />
        <Kpi label="Non visualizzati" value={stats.neverOpened} />
        <Kpi label="Già sollecitati" value={stats.contacted} />
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
            prefetch={false}
          >
            {filter.label}
          </Link>
        ))}
      </nav>

      <section className="mt-6 grid gap-4">
        {visibleGroups.length === 0 ? (
          <div className="rounded-2xl bg-white p-6 text-ischia-ink/70 ring-1 ring-slate-200">Nessun preventivo in questa lista.</div>
        ) : (
          visibleGroups.map((group) => <FollowUpCard key={group.key} group={group} />)
        )}
      </section>
    </AdminShell>
  );
}

function DataUnavailable({ error }: { error?: string }) {
  return (
    <div className="rounded-2xl bg-red-50 p-5 text-sm font-semibold text-red-800 shadow-soft ring-1 ring-red-200">
      <p className="text-base font-black">Follow-up non disponibile</p>
      <p className="mt-2">
        Connessione al database eventi non riuscita. Per evitare liste parziali o dati non reali, il follow-up resta nascosto finché Supabase non risponde correttamente.
      </p>
      {error ? <p className="mt-3 break-words text-xs text-red-700/80">Dettaglio tecnico: {error}</p> : null}
    </div>
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

function FollowUpCard({ group }: { group: FollowUpGroup }) {
  const quote = group.primary;
  return (
    <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${segmentClass(group.segment)}`}>{group.segmentLabel}</span>
            <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${priorityClass(group.priority)}`}>Priorità {group.priority}</span>
            {quote.expiresSoon ? <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black uppercase text-amber-800">Scadenza vicina</span> : null}
            {group.emailInfo.problem ? <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-black uppercase text-rose-800">{group.emailInfo.label}</span> : null}
            {!group.emailInfo.problem && group.emailInfo.clicked ? <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black uppercase text-emerald-800">{group.emailInfo.label}</span> : null}
            {!group.emailInfo.problem && !group.emailInfo.clicked && group.emailInfo.label ? <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-black uppercase text-sky-800">{group.emailInfo.label}</span> : null}
            {quote.segment === "non_visualizzato" ? <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-black uppercase text-violet-800">{quote.stageLabel}</span> : null}
            {group.isSnoozed && group.snoozedUntil ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase text-slate-700">Rimandato a {formatDate(group.snoozedUntil)}</span> : null}
          </div>
          <h2 className="mt-3 text-2xl font-black text-ischia-navy">{quote.clientName}</h2>
          <p className="mt-1 text-sm font-semibold text-ischia-ink/65">
            {group.quotes.length} {group.quotes.length === 1 ? "preventivo" : "preventivi"} · ultimo invio {formatDate(quote.sentAt)}
          </p>
          <p className="mt-3 text-sm text-ischia-ink/75">
            {quote.clientPhone || "Telefono assente"} · {quote.clientEmail || "Email assente"}
          </p>
        </div>

        <div className="flex flex-wrap justify-start gap-2 lg:max-w-[56rem] lg:justify-end">
          <a className="inline-flex h-9 items-center justify-center rounded-full bg-ischia-navy px-3.5 text-center text-xs font-black text-white transition hover:bg-ischia-blue" href={quote.publicUrl} rel="noreferrer" target="_blank">
            Apri preventivo
          </a>
          {!quote.isClosed ? <FollowUpWhatsAppButton href={quote.whatsappHref} quoteCode={quote.code} token={quote.token} segment={quote.segment} clientPhone={quote.clientPhone} /> : null}
          <a className="inline-flex h-9 items-center justify-center rounded-full bg-white px-3.5 text-center text-xs font-black text-ischia-navy ring-1 ring-ischia-blue/20" href={`tel:${quote.clientPhone.replace(/\D/g, "")}`}>
            Chiama
          </a>
          <FollowUpActionButtons quoteId={quote.id} isClosed={quote.isClosed} />
        </div>
      </div>

      <div className="mt-5 grid gap-3 text-sm md:grid-cols-5">
        <Info label="Ultimo evento" value={group.lastEventAt ? `${group.lastEventLabel} · ${formatDateTime(group.lastEventAt)}` : group.lastEventLabel} />
        <Info label="Visualizzazioni" value={String(group.totalOpenings)} />
        <Info label="Provenienza" value={quote.openingSources.length ? quote.openingSources.join(", ") : "Non visualizzato"} />
        <Info label="Click WhatsApp cliente" value={String(group.totalWhatsappClicks)} />
        <Info label="Click hotel / PDF" value={`${group.totalHotelClicks} / ${group.totalPrints}`} />
      </div>

      <div className="mt-4 grid gap-3 text-sm md:grid-cols-2 lg:grid-cols-4">
        <Info label="Punteggio interesse" value={String(group.engagementScore)} />
        <Info label="Ultimo follow-up" value={group.lastFollowUpAt ? formatDateTime(group.lastFollowUpAt) : "Non ancora registrato"} />
        {group.emailInfo.label ? <Info label="Stato email" value={group.emailInfo.label} /> : null}
        {group.emailInfo.actionHint ? <Info label="Azione consigliata" value={group.emailInfo.actionHint} /> : null}
      </div>
      <div className="mt-4 grid gap-3 text-sm">
        <Info label="Date soggiorno" value={group.staySummary} />
        <Info label="Hotel proposti" value={quote.hotelsSummary || "Non indicati"} />
        {group.hotelClicks.length ? <Info label="Hotel cliccati" value={summarizeHotelClicks(group.hotelClicks)} /> : null}
      </div>
      {group.quotes.length > 1 ? (
        <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm">
          <p className="text-xs font-black uppercase text-ischia-ink/45">Preventivi collegati</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {group.quotes.map((item) => (
              <Link key={item.id} className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-ischia-navy ring-1 ring-slate-200" href={`/admin/preventivi/${item.code}`}>
                {item.code}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
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

function summarizeHotelClicks(clicks: FollowUpHotelClick[]) {
  const grouped = new Map<string, { hotelName: string; quoteCode: string; count: number }>();
  for (const click of clicks) {
    const key = `${click.quoteCode}:${click.hotelName}`;
    const current = grouped.get(key);
    grouped.set(key, {
      hotelName: click.hotelName,
      quoteCode: click.quoteCode,
      count: (current?.count ?? 0) + 1
    });
  }
  return Array.from(grouped.values())
    .map((item) => `${item.hotelName} (${item.quoteCode}${item.count > 1 ? `, ${item.count} clic` : ""})`)
    .join(" · ");
}

function normalizeFilter(value?: string): FollowUpFilter {
  return filters.some((filter) => filter.value === value) ? value as FollowUpFilter : "caldi";
}

function matchesFilter(group: FollowUpGroup, filter: FollowUpFilter, dueCustomerKeys: Set<string>) {
  if (filter === "tutti") return true;
  if (filter === "gia_richiamati") return Boolean(group.lastFollowUpAt) && !group.primary.isClosed;
  if (filter === "storici") return group.segment === "storico_non_affidabile";
  if (filter === "chiusi") return group.primary.isClosed;
  if (group.primary.isClosed || group.segment === "storico_non_affidabile") return false;
  if (group.isSnoozed) return false;
  if (group.lastFollowUpAt && filter !== "non_visualizzati") return false;
  if (filter === "caldi") return group.priority === "alta";
  if (filter === "non_visualizzati") return dueCustomerKeys.has(group.key);
  return group.segment === "da_sollecitare";
}

function groupFollowUps(quotes: FollowUpQuote[]): FollowUpGroup[] {
  const map = new Map<string, FollowUpQuote[]>();
  for (const quote of quotes) {
    const key = followUpCustomerKey(quote);
    map.set(key, [...(map.get(key) ?? []), quote]);
  }

  return Array.from(map.entries()).map(([key, items]) => {
    const sorted = [...items].sort((a, b) =>
      b.engagementScore - a.engagementScore ||
      priorityWeight(b.priority) - priorityWeight(a.priority) ||
      new Date(b.lastEventAt ?? b.sentAt).getTime() - new Date(a.lastEventAt ?? a.sentAt).getTime()
    );
    const primary = sorted[0];
    const lastEventQuote = sorted
      .filter((quote) => quote.lastEventAt)
      .sort((a, b) => new Date(b.lastEventAt!).getTime() - new Date(a.lastEventAt!).getTime())[0];
    const lastEventAt = lastEventQuote?.lastEventAt;
    const lastFollowUpAt = sorted.map((quote) => quote.lastFollowUpAt).filter(Boolean).sort().at(-1);
    const snoozedUntil = sorted.map((quote) => quote.snoozedUntil).filter(Boolean).sort().at(-1);
    const totalOpenings = sorted.reduce((sum, quote) => sum + quote.openedCount, 0);
    const engagementScore = sorted.reduce((sum, quote) => sum + quote.engagementScore, 0);
    const segment = followUpGroupSegment(sorted, totalOpenings, engagementScore);
    const priority = priorityForSegment(segment);
    const staySummary = summarizeStayDates(sorted);
    const emailInfo = sorted.reduce<FollowUpEmailInfo>(
      (acc, quote) => ({
        delivered: acc.delivered || quote.emailInfo.delivered,
        opened: acc.opened || quote.emailInfo.opened,
        clicked: acc.clicked || quote.emailInfo.clicked,
        problem: acc.problem || quote.emailInfo.problem,
        label: quote.emailInfo.label || acc.label,
        actionHint: quote.emailInfo.actionHint || acc.actionHint
      }),
      { delivered: false, opened: false, clicked: false, problem: false, label: "", actionHint: "" }
    );

    return {
      key,
      primary,
      quotes: sorted,
      totalOpenings,
      totalWhatsappClicks: sorted.reduce((sum, quote) => sum + quote.whatsappClickCount, 0),
      totalHotelClicks: sorted.reduce((sum, quote) => sum + quote.hotelLinkClickCount, 0),
      hotelClicks: sorted.flatMap((quote) => quote.hotelLinkClicks),
      totalPrints: sorted.reduce((sum, quote) => sum + quote.printClickCount, 0),
      totalConfirmClicks: sorted.reduce((sum, quote) => sum + quote.confirmClickCount, 0),
      engagementScore,
      segment,
      segmentLabel: labelForSegment(segment),
      priority,
      lastEventAt,
      lastEventLabel: lastEventQuote?.lastEventLabel ?? "Nessuna visualizzazione tracciata",
      lastFollowUpAt,
      snoozedUntil,
      staySummary,
      isSnoozed: Boolean(snoozedUntil && new Date(snoozedUntil).getTime() > Date.now()),
      isContactDue: sorted.some((quote) => isFollowUpStageDue(quote.sentAt, lastFollowUpAt)),
      emailInfo
    };
  }).sort((a, b) =>
    b.engagementScore - a.engagementScore ||
    priorityWeight(b.priority) - priorityWeight(a.priority) ||
    new Date(b.lastEventAt ?? b.primary.sentAt).getTime() - new Date(a.lastEventAt ?? a.primary.sentAt).getTime()
  );
}

function labelForSegment(segment: FollowUpSegment) {
  const labels: Record<FollowUpSegment, string> = {
    non_visualizzato: "Preventivo non visualizzato",
    aperto_non_confermato: "Aperto non confermato",
    molto_interessato: "Molto interessato",
    da_sollecitare: "Da sollecitare",
    recente: "Inviato da poco",
    storico_non_affidabile: "Tracking storico non affidabile",
    chiuso: "Follow-up chiuso"
  };
  return labels[segment];
}

function priorityForSegment(segment: FollowUpSegment): FollowUpQuote["priority"] {
  if (segment === "molto_interessato" || segment === "da_sollecitare") return "alta";
  if (segment === "non_visualizzato" || segment === "aperto_non_confermato") return "media";
  return "bassa";
}

function segmentClass(segment: FollowUpSegment) {
  const classes: Record<FollowUpSegment, string> = {
    non_visualizzato: "bg-slate-100 text-slate-700",
    aperto_non_confermato: "bg-sky-100 text-sky-800",
    molto_interessato: "bg-emerald-100 text-emerald-800",
    da_sollecitare: "bg-amber-100 text-amber-800",
    recente: "bg-indigo-100 text-indigo-800",
    storico_non_affidabile: "bg-stone-100 text-stone-700",
    chiuso: "bg-zinc-200 text-zinc-700"
  };
  return classes[segment];
}

function priorityClass(priority: FollowUpQuote["priority"]) {
  return priority === "alta" ? "bg-red-100 text-red-800" : priority === "media" ? "bg-orange-100 text-orange-800" : "bg-slate-100 text-slate-700";
}

function priorityWeight(priority: FollowUpQuote["priority"]) {
  return priority === "alta" ? 3 : priority === "media" ? 2 : 1;
}

function summarizeStayDates(quotes: FollowUpQuote[]) {
  const ranges = Array.from(new Map(
    quotes.map((quote) => [
      `${quote.arrivalDate}|${quote.departureDate}`,
      {
        arrivalDate: quote.arrivalDate,
        departureDate: quote.departureDate,
        codes: [quote.code]
      }
    ])
  ).values());

  for (const quote of quotes) {
    const key = `${quote.arrivalDate}|${quote.departureDate}`;
    const range = ranges.find((item) => `${item.arrivalDate}|${item.departureDate}` === key);
    if (range && !range.codes.includes(quote.code)) range.codes.push(quote.code);
  }

  return ranges
    .map((range) => {
      const label = `${formatDate(range.arrivalDate)} - ${formatDate(range.departureDate)}`;
      return ranges.length > 1 ? `${range.codes.join(", ")}: ${label}` : label;
    })
    .join(" · ");
}
