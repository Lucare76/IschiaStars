import { listPendingQuoteRequests } from "@/lib/repositories/quoteRequests";
import { getDashboardEventStats } from "@/lib/repositories/quoteEvents";
import { getDueFollowUpCustomerKeys, getFollowUpQuotes } from "@/lib/repositories/followUp";
import { listQuotes } from "@/lib/repositories/quotes";
import { fallback, fromSupabase, RepositoryResult } from "@/lib/repositories/shared";
import { isStayExpiredRome } from "@/lib/date-format";
import { followUpCustomerKey, hasReliableQuoteTracking, isFollowUpStageDue } from "@/lib/follow-up-policy";
import type { Quote, QuoteRequest } from "@/lib/types";

export type DashboardStats = {
  createdQuotes: number;
  pendingRequests: number;
  sentQuotes: number;
  expiredQuotes: number;
  openedQuotes: number;
  unopenedQuotes: number;
  toContactToday: number;
  confirmedQuotes: number;
  lostQuotes: number;
  conversionRate: number;
  whatsappClicks: number;
  confirmedValue: number;
  depositReceivedValue: number;
};

export async function getDashboardStats(): Promise<RepositoryResult<DashboardStats>> {
  const [quotesResult, requestsResult, eventsResult, followUpResult] = await Promise.all([
    listQuotes({ includeDeleted: false }),
    listPendingQuoteRequests(),
    getDashboardEventStats(),
    getFollowUpQuotes()
  ]);

  const stats = buildDashboardStats({
    quotes: quotesResult.data,
    pendingRequests: requestsResult.data,
    openedQuoteIds: eventsResult.data.openedQuoteIds,
    confirmedEventIds: eventsResult.data.confirmedEventIds,
    whatsappClickQuoteIds: eventsResult.data.whatsappClickQuoteIds,
    closedFollowUpQuoteIds: eventsResult.data.closedFollowUpQuoteIds,
    snoozedUntilByQuote: eventsResult.data.snoozedUntilByQuote,
    lastContactAtByQuote: eventsResult.data.lastContactAtByQuote,
    toContactTodayOverride: getDueFollowUpCustomerKeys(followUpResult.data).size
  });

  const error = [quotesResult.error, requestsResult.error, eventsResult.error, followUpResult.error].filter(Boolean).join(" | ") || undefined;
  return quotesResult.source === "supabase" && requestsResult.source === "supabase" && eventsResult.source === "supabase" && followUpResult.source === "supabase"
    ? fromSupabase(stats)
    : fallback(stats, error);
}

export function buildDashboardStats({
  quotes,
  pendingRequests,
  openedQuoteIds,
  confirmedEventIds,
  whatsappClickQuoteIds,
  closedFollowUpQuoteIds = new Set<string>(),
  snoozedUntilByQuote = {},
  lastContactAtByQuote = {},
  toContactTodayOverride
}: {
  quotes: Quote[];
  pendingRequests: QuoteRequest[];
  openedQuoteIds: Set<string>;
  confirmedEventIds: Set<string>;
  whatsappClickQuoteIds: string[];
  closedFollowUpQuoteIds?: Set<string>;
  snoozedUntilByQuote?: Record<string, string>;
  lastContactAtByQuote?: Record<string, string>;
  toContactTodayOverride?: number;
}): DashboardStats {
  // Solo preventivi attivi nelle statistiche: non cancellati e non esclusi
  const activeQuotes = quotes.filter((quote) => !quote.deletedAt && !quote.excludedFromStats);
  const activeIds = new Set(activeQuotes.map((quote) => quote.id));

  // Filtra eventi per soli preventivi attivi
  const activeOpenedIds = new Set(Array.from(openedQuoteIds).filter((id) => activeIds.has(id)));
  const activeConfirmedIds = new Set(Array.from(confirmedEventIds).filter((id) => activeIds.has(id)));
  const activeWhatsappClicks = whatsappClickQuoteIds.filter((id) => activeIds.has(id)).length;

  const confirmed = activeQuotes.filter((quote) => quote.status === "confermato" || Boolean(quote.confirmation) || activeConfirmedIds.has(quote.id));
  const confirmedIds = new Set(confirmed.map((quote) => quote.id));
  const sentUnconfirmed = activeQuotes.filter((quote) => quote.status === "preventivo_inviato" && !confirmedIds.has(quote.id));
  const expired = sentUnconfirmed.filter((quote) => isStayExpiredRome(quote.departureDate));
  const evaded = sentUnconfirmed.filter((quote) => !isStayExpiredRome(quote.departureDate));
  const opened = evaded.filter((quote) => activeOpenedIds.has(quote.id));
  const unopened = evaded.filter((quote) => hasReliableQuoteTracking(quote.sentAt ?? quote.createdAt) && !activeOpenedIds.has(quote.id));
  const now = Date.now();
  const confirmedCustomerKeys = new Set(
    confirmed
      .filter((quote) => new Date(quote.departureDate).getTime() >= now)
      .map(followUpCustomerKey)
      .filter(Boolean)
  );
  const followUpGroups = new Map<string, Quote[]>();
  for (const quote of evaded) {
    const nights = Math.round((new Date(quote.departureDate).getTime() - new Date(quote.arrivalDate).getTime()) / (24 * 60 * 60 * 1000));
    const customerKey = followUpCustomerKey(quote);
    if (
      nights < 4 ||
      new Date(quote.arrivalDate).getTime() < now ||
      !hasReliableQuoteTracking(quote.sentAt ?? quote.createdAt) ||
      !customerKey ||
      confirmedCustomerKeys.has(customerKey)
    ) continue;
    followUpGroups.set(customerKey, [...(followUpGroups.get(customerKey) ?? []), quote]);
  }
  const toContactToday = Array.from(followUpGroups.values()).filter((group) => {
    if (group.some((quote) => activeOpenedIds.has(quote.id))) return false;
    if (group.some((quote) => closedFollowUpQuoteIds.has(quote.id))) return false;
    const snoozedUntil = group
      .map((quote) => snoozedUntilByQuote[quote.id])
      .filter(Boolean)
      .sort()
      .at(-1);
    if (snoozedUntil && new Date(snoozedUntil).getTime() > now) return false;
    const lastContactAt = group
      .map((quote) => lastContactAtByQuote[quote.id])
      .filter(Boolean)
      .sort()
      .at(-1);
    return group.some((quote) => isFollowUpStageDue(quote.sentAt ?? quote.createdAt, lastContactAt, now));
  });

  return {
    createdQuotes: activeQuotes.length,
    pendingRequests: pendingRequests.length,
    sentQuotes: evaded.length,
    expiredQuotes: expired.length,
    openedQuotes: opened.length,
    unopenedQuotes: unopened.length,
    toContactToday: toContactTodayOverride ?? toContactToday.length,
    confirmedQuotes: confirmed.length,
    lostQuotes: activeQuotes.filter((quote) => quote.status === "perso_non_disponibile").length,
    conversionRate: activeQuotes.length ? Math.round((confirmed.length / activeQuotes.length) * 100) : 0,
    whatsappClicks: activeWhatsappClicks,
    confirmedValue: confirmed.reduce((sum, quote) => sum + quote.totalPrice, 0),
    depositReceivedValue: activeQuotes.reduce((sum, quote) => {
      const c = quote.confirmation;
      if (!c?.depositPaidAt) return sum;
      const deposit = c.selectedDepositAmount ?? 0;
      const balance = c.balancePaidAt ? (c.selectedBalanceAmount ?? 0) : 0;
      return sum + deposit + balance;
    }, 0)
  };
}
