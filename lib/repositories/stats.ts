import { countPendingQuoteRequests } from "@/lib/repositories/quoteRequests";
import { fallback, fromSupabase, RepositoryResult } from "@/lib/repositories/shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isStayExpiredRome } from "@/lib/date-format";
import { hasReliableQuoteTracking } from "@/lib/follow-up-policy";
import { getTrackingExcludedIps, isExcludedTrackingEvent } from "@/lib/server/trackingFilters";
import type { QuoteEvent } from "@/lib/types";

export type DashboardStats = {
  createdQuotes: number;
  pendingRequests: number;
  sentQuotes: number;
  expiredQuotes: number;
  openedQuotes: number;
  unopenedQuotes: number;
  confirmedQuotes: number;
  lostQuotes: number;
  conversionRate: number;
  whatsappClicks: number;
  confirmedValue: number;
  depositReceivedValue: number;
  repeatedlyViewedQuotes: number;
  hotCustomers: number;
};

type DashboardQuoteRow = {
  id: string;
  status: string | null;
  total_price: number | string | null;
  check_out: string | null;
  created_at: string;
  confirmed_at?: string | null;
  deleted_at?: string | null;
  excluded_from_stats?: boolean | null;
};

const OPENINGS_PAGE_SIZE = 1000;
const DASHBOARD_QUOTES_PAGE_SIZE = 1000;

export async function getDashboardStats(): Promise<RepositoryResult<DashboardStats>> {
  const empty = emptyDashboardStats();

  const [quotesResult, confirmationsResult, pendingCountResult, eventsResult, openingCountsResult] = await Promise.all([
    getDashboardQuoteRows(),
    getConfirmedQuoteIds(),
    countPendingQuoteRequests(),
    getDashboardEventSummary(),
    getOpeningCounts()
  ]);

  const error = [quotesResult.error, confirmationsResult.error, pendingCountResult.error, eventsResult.error, openingCountsResult.error]
    .filter(Boolean)
    .join(" | ") || undefined;

  if (quotesResult.error || confirmationsResult.error || eventsResult.error || openingCountsResult.error) return fallback(empty, error);

  const quotes = (quotesResult.data ?? []) as DashboardQuoteRow[];
  const stats = buildDashboardStatsFromRows({
    quotes,
    pendingRequests: pendingCountResult.data,
    confirmedQuoteIds: confirmationsResult.data,
    openedQuoteIds: eventsResult.data.openedQuoteIds,
    confirmedEventIds: eventsResult.data.confirmedEventIds,
    whatsappClickQuoteIds: eventsResult.data.whatsappClickQuoteIds,
    openingCountByQuote: openingCountsResult.data
  });

  return fromSupabase(stats);
}

async function getDashboardQuoteRows(): Promise<RepositoryResult<DashboardQuoteRow[]>> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return fallback([]);

  const rows: DashboardQuoteRow[] = [];

  for (let from = 0; ; from += DASHBOARD_QUOTES_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("quotes")
      .select("id,status,total_price,check_out,created_at,confirmed_at,deleted_at,excluded_from_stats")
      .is("deleted_at", null)
      .or("metadata->>is_lab_test.is.null,metadata->>is_lab_test.neq.true")
      .range(from, from + DASHBOARD_QUOTES_PAGE_SIZE - 1);

    if (error) return fallback([], error);

    const page = (data ?? []) as DashboardQuoteRow[];
    rows.push(...page);

    if (page.length < DASHBOARD_QUOTES_PAGE_SIZE) break;
  }

  return fromSupabase(rows);
}

function buildDashboardStatsFromRows({
  quotes,
  pendingRequests,
  confirmedQuoteIds,
  openedQuoteIds,
  confirmedEventIds,
  whatsappClickQuoteIds,
  openingCountByQuote
}: {
  quotes: DashboardQuoteRow[];
  pendingRequests: number;
  confirmedQuoteIds: Set<string>;
  openedQuoteIds: Set<string>;
  confirmedEventIds: Set<string>;
  whatsappClickQuoteIds: string[];
  openingCountByQuote: Record<string, number>;
}): DashboardStats {
  const activeQuotes = quotes.filter((quote) => !quote.deleted_at && !quote.excluded_from_stats);
  const activeIds = new Set(activeQuotes.map((quote) => quote.id));
  const activeOpenedIds = new Set(Array.from(openedQuoteIds).filter((id) => activeIds.has(id)));
  const activeConfirmedIds = new Set(Array.from(confirmedEventIds).filter((id) => activeIds.has(id)));
  const confirmed = activeQuotes.filter((quote) =>
    quote.status === "confermato" ||
    Boolean(quote.confirmed_at) ||
    confirmedQuoteIds.has(quote.id) ||
    activeConfirmedIds.has(quote.id)
  );
  const confirmedIds = new Set(confirmed.map((quote) => quote.id));
  const sentUnconfirmed = activeQuotes.filter((quote) => quote.status === "preventivo_inviato" && !confirmedIds.has(quote.id));
  const expired = sentUnconfirmed.filter((quote) => quote.check_out && isStayExpiredRome(quote.check_out));
  const evaded = sentUnconfirmed.filter((quote) => quote.check_out && !isStayExpiredRome(quote.check_out));
  const opened = evaded.filter((quote) => activeOpenedIds.has(quote.id));
  const unopened = evaded.filter((quote) => hasReliableQuoteTracking(quote.created_at) && !activeOpenedIds.has(quote.id));
  const repeatedlyViewed = evaded.filter((quote) => (openingCountByQuote[quote.id] ?? 0) >= 2);
  const hotCustomers = evaded.filter((quote) => (openingCountByQuote[quote.id] ?? 0) >= 3);

  return {
    createdQuotes: activeQuotes.length,
    pendingRequests,
    sentQuotes: evaded.length,
    expiredQuotes: expired.length,
    openedQuotes: opened.length,
    unopenedQuotes: unopened.length,
    confirmedQuotes: confirmed.length,
    lostQuotes: activeQuotes.filter((quote) => quote.status === "perso_non_disponibile").length,
    conversionRate: activeQuotes.length ? Math.round((confirmed.length / activeQuotes.length) * 100) : 0,
    whatsappClicks: whatsappClickQuoteIds.filter((id) => activeIds.has(id)).length,
    confirmedValue: confirmed.reduce((sum, quote) => sum + Number(quote.total_price ?? 0), 0),
    depositReceivedValue: 0,
    repeatedlyViewedQuotes: repeatedlyViewed.length,
    hotCustomers: hotCustomers.length
  };
}

async function getDashboardEventSummary(): Promise<RepositoryResult<{
  openedQuoteIds: Set<string>;
  confirmedEventIds: Set<string>;
  whatsappClickQuoteIds: string[];
}>> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return fallback({
      openedQuoteIds: new Set<string>(),
      confirmedEventIds: new Set<string>(),
      whatsappClickQuoteIds: []
    });
  }

  const { data, error } = await supabase.rpc("get_dashboard_event_stats", {
    p_excluded_ips: getTrackingExcludedIps()
  }).maybeSingle();

  if (error) {
    return fallback({
      openedQuoteIds: new Set<string>(),
      confirmedEventIds: new Set<string>(),
      whatsappClickQuoteIds: []
    }, error);
  }

  const aggregates = (data ?? {}) as Record<string, string[] | null | undefined>;
  return fromSupabase({
    openedQuoteIds: new Set<string>(aggregates.opened_quote_ids ?? []),
    confirmedEventIds: new Set<string>(aggregates.confirmed_quote_ids ?? []),
    whatsappClickQuoteIds: aggregates.whatsapp_click_quote_ids ?? []
  });
}

async function getConfirmedQuoteIds(): Promise<RepositoryResult<Set<string>>> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return fallback(new Set<string>());

  const { data, error } = await supabase
    .from("quote_confirmations")
    .select("quote_id");

  if (error) return fallback(new Set<string>(), error);
  return fromSupabase(new Set((data ?? []).map((row) => String(row.quote_id)).filter(Boolean)));
}

async function getOpeningCounts(): Promise<RepositoryResult<Record<string, number>>> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return fallback({});

  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += OPENINGS_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("quote_events")
      .select("id,quote_id,event_type,created_at,user_agent,metadata")
      .eq("event_type", "quote_opened")
      .order("created_at", { ascending: true })
      .range(from, from + OPENINGS_PAGE_SIZE - 1);
    if (error) return fallback({}, error);
    rows.push(...(data ?? []));
    if ((data ?? []).length < OPENINGS_PAGE_SIZE) break;
  }

  const events = deduplicateRecentOpenings(
    rows.map((row, index) => ({
      id: String(row.id ?? `dashboard-opening-${index}`),
      quoteId: String(row.quote_id),
      eventType: "quote_opened" as const,
      createdAt: String(row.created_at),
      userAgent: row.user_agent ? String(row.user_agent) : undefined,
      metadata: row.metadata && typeof row.metadata === "object" ? row.metadata as Record<string, unknown> : {}
    })).filter((event) => !isExcludedTrackingEvent(event))
  );

  return fromSupabase(events.reduce<Record<string, number>>((counts, event) => {
    counts[event.quoteId] = (counts[event.quoteId] ?? 0) + 1;
    return counts;
  }, {}));
}

function deduplicateRecentOpenings(events: QuoteEvent[]) {
  const ordered = [...events].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const seenIds = new Set<string>();
  const lastOpeningByVisitor = new Map<string, number>();
  return ordered.filter((event) => {
    if (seenIds.has(event.id)) return false;
    seenIds.add(event.id);
    const visitorId = typeof event.metadata?.visitor_id === "string" ? event.metadata.visitor_id : "";
    if (!visitorId) return true;
    const visitorKey = `${event.quoteId}:${visitorId}`;
    const timestamp = new Date(event.createdAt).getTime();
    const previous = lastOpeningByVisitor.get(visitorKey);
    if (previous !== undefined && timestamp - previous < 30 * 60 * 1000) return false;
    lastOpeningByVisitor.set(visitorKey, timestamp);
    return true;
  });
}

function emptyDashboardStats(): DashboardStats {
  return {
    createdQuotes: 0,
    pendingRequests: 0,
    sentQuotes: 0,
    expiredQuotes: 0,
    openedQuotes: 0,
    unopenedQuotes: 0,
    confirmedQuotes: 0,
    lostQuotes: 0,
    conversionRate: 0,
    whatsappClicks: 0,
    confirmedValue: 0,
    depositReceivedValue: 0,
    repeatedlyViewedQuotes: 0,
    hotCustomers: 0
  };
}
