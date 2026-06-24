import { listPendingQuoteRequests } from "@/lib/repositories/quoteRequests";
import { getDashboardEventStats } from "@/lib/repositories/quoteEvents";
import { getQuoteEmailDashboardData, type QuoteEmailDashboardData } from "@/lib/repositories/emailLogs";
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
  emailSent: number;
  emailDelivered: number;
  emailOpened: number;
  emailClicked: number;
  emailProblems: number;
  clickedUnconfirmedQuotes: number;
  repeatedlyViewedQuotes: number;
  hotCustomers: number;
  attentionItems: CommercialAttentionItem[];
};

export type CommercialAttentionItem = {
  quoteId: string;
  quoteCode: string;
  customerName: string;
  status: string;
  action: "Richiamare" | "Inviare follow-up" | "Verificare email" | "Attendere";
  priority: "alta" | "media" | "bassa";
};

export async function getDashboardStats(): Promise<RepositoryResult<DashboardStats>> {
  const [quotesResult, requestsResult, eventsResult, followUpResult, emailResult] = await Promise.all([
    listQuotes({ includeDeleted: false }),
    listPendingQuoteRequests(),
    getDashboardEventStats(),
    getFollowUpQuotes(),
    getQuoteEmailDashboardData()
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
    toContactTodayOverride: getDueFollowUpCustomerKeys(followUpResult.data).size,
    openingCountByQuote: eventsResult.data.openingCountByQuote,
    emailData: emailResult.data
  });

  const error = [quotesResult.error, requestsResult.error, eventsResult.error, followUpResult.error, emailResult.error].filter(Boolean).join(" | ") || undefined;
  return quotesResult.source === "supabase" && requestsResult.source === "supabase" && eventsResult.source === "supabase" && followUpResult.source === "supabase" && emailResult.source === "supabase"
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
  toContactTodayOverride,
  openingCountByQuote = {},
  emailData = emptyEmailDashboardData()
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
  openingCountByQuote?: Record<string, number>;
  emailData?: QuoteEmailDashboardData;
}): DashboardStats {
  // Solo preventivi attivi nelle statistiche: non cancellati e non esclusi
  const activeQuotes = quotes.filter((quote) => !quote.deletedAt && !quote.excludedFromStats);
  const activeIds = new Set(activeQuotes.map((quote) => quote.id));
  const activeEmailTotals = Array.from(activeIds).reduce((totals, quoteId) => {
    const email = emailData.byQuoteId[quoteId];
    if (!email) return totals;
    totals.sent += email.sentCount;
    totals.delivered += email.deliveredCount;
    totals.opened += email.openedCount;
    totals.clicked += email.clickedCount;
    totals.problems += email.problemCount;
    return totals;
  }, { sent: 0, delivered: 0, opened: 0, clicked: 0, problems: 0 });

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
  const clickedUnconfirmed = evaded.filter((quote) => emailData.byQuoteId[quote.id]?.clicked);
  const repeatedlyViewed = evaded.filter((quote) => (openingCountByQuote[quote.id] ?? 0) >= 2);
  const hotCustomers = evaded.filter((quote) =>
    emailData.byQuoteId[quote.id]?.clicked || (openingCountByQuote[quote.id] ?? 0) >= 3
  );
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
    }, 0),
    emailSent: activeEmailTotals.sent,
    emailDelivered: activeEmailTotals.delivered,
    emailOpened: activeEmailTotals.opened,
    emailClicked: activeEmailTotals.clicked,
    emailProblems: activeEmailTotals.problems,
    clickedUnconfirmedQuotes: clickedUnconfirmed.length,
    repeatedlyViewedQuotes: repeatedlyViewed.length,
    hotCustomers: hotCustomers.length,
    attentionItems: buildAttentionItems(evaded, activeOpenedIds, openingCountByQuote, emailData)
  };
}

function buildAttentionItems(
  quotes: Quote[],
  openedQuoteIds: Set<string>,
  openingCountByQuote: Record<string, number>,
  emailData: QuoteEmailDashboardData
): CommercialAttentionItem[] {
  const now = Date.now();
  return quotes
    .map((quote): (CommercialAttentionItem & { score: number; activityAt: string }) | null => {
      const email = emailData.byQuoteId[quote.id];
      const customerName = [quote.customerFirstName, quote.customerLastName].filter(Boolean).join(" ").trim() || "Cliente";
      const activityAt = email?.lastActivityAt ?? quote.sentAt ?? quote.createdAt;

      if (email?.problem) {
        return {
          quoteId: quote.id,
          quoteCode: quote.code,
          customerName,
          status: "Email non consegnata",
          action: "Verificare email",
          priority: "alta",
          score: 400,
          activityAt
        };
      }
      if (email?.clicked) {
        return {
          quoteId: quote.id,
          quoteCode: quote.code,
          customerName,
          status: "Link email cliccato, non confermato",
          action: "Richiamare",
          priority: "alta",
          score: 300 + (openingCountByQuote[quote.id] ?? 0),
          activityAt
        };
      }
      if (openedQuoteIds.has(quote.id)) {
        const openings = openingCountByQuote[quote.id] ?? 1;
        return {
          quoteId: quote.id,
          quoteCode: quote.code,
          customerName,
          status: openings >= 2 ? `Preventivo visualizzato ${openings} volte` : "Preventivo visualizzato, non confermato",
          action: openings >= 2 ? "Richiamare" : "Inviare follow-up",
          priority: openings >= 2 ? "alta" : "media",
          score: 200 + openings,
          activityAt
        };
      }
      if (email?.sent) {
        const hoursSinceSent = Math.max(0, now - new Date(quote.sentAt ?? quote.createdAt).getTime()) / (60 * 60 * 1000);
        return {
          quoteId: quote.id,
          quoteCode: quote.code,
          customerName,
          status: "Preventivo inviato, mai visualizzato",
          action: hoursSinceSent >= 24 ? "Inviare follow-up" : "Attendere",
          priority: hoursSinceSent >= 24 ? "media" : "bassa",
          score: hoursSinceSent >= 24 ? 100 : 10,
          activityAt
        };
      }
      return null;
    })
    .filter((item): item is CommercialAttentionItem & { score: number; activityAt: string } => Boolean(item))
    .sort((a, b) => b.score - a.score || new Date(b.activityAt).getTime() - new Date(a.activityAt).getTime())
    .slice(0, 8)
    .map(({ score: _score, activityAt: _activityAt, ...item }) => item);
}

function emptyEmailDashboardData(): QuoteEmailDashboardData {
  return {
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    problems: 0,
    byQuoteId: {}
  };
}
