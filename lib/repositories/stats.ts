import { listPendingQuoteRequests } from "@/lib/repositories/quoteRequests";
import { getDashboardEventStats } from "@/lib/repositories/quoteEvents";
import { listQuotes } from "@/lib/repositories/quotes";
import { fallback, fromSupabase, RepositoryResult } from "@/lib/repositories/shared";
import type { Quote, QuoteRequest } from "@/lib/types";

export type DashboardStats = {
  createdQuotes: number;
  pendingRequests: number;
  sentQuotes: number;
  openedQuotes: number;
  confirmedQuotes: number;
  lostQuotes: number;
  conversionRate: number;
  whatsappClicks: number;
  confirmedValue: number;
};

export async function getDashboardStats(): Promise<RepositoryResult<DashboardStats>> {
  const [quotesResult, requestsResult, eventsResult] = await Promise.all([
    listQuotes({ includeDeleted: false }),
    listPendingQuoteRequests(),
    getDashboardEventStats()
  ]);

  const stats = buildDashboardStats({
    quotes: quotesResult.data,
    pendingRequests: requestsResult.data,
    openedQuoteIds: eventsResult.data.openedQuoteIds,
    confirmedEventIds: eventsResult.data.confirmedEventIds,
    whatsappClickQuoteIds: eventsResult.data.whatsappClickQuoteIds
  });

  const error = [quotesResult.error, requestsResult.error, eventsResult.error].filter(Boolean).join(" | ") || undefined;
  return quotesResult.source === "supabase" && requestsResult.source === "supabase" && eventsResult.source === "supabase"
    ? fromSupabase(stats)
    : fallback(stats, error);
}

export function buildDashboardStats({
  quotes,
  pendingRequests,
  openedQuoteIds,
  confirmedEventIds,
  whatsappClickQuoteIds
}: {
  quotes: Quote[];
  pendingRequests: QuoteRequest[];
  openedQuoteIds: Set<string>;
  confirmedEventIds: Set<string>;
  whatsappClickQuoteIds: string[];
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
  const evaded = activeQuotes.filter((quote) => !confirmedIds.has(quote.id) && quote.status !== "perso_non_disponibile");
  const opened = activeQuotes.filter((quote) => quote.status === "preventivo_inviato" && activeOpenedIds.has(quote.id));

  return {
    createdQuotes: activeQuotes.length,
    pendingRequests: pendingRequests.length,
    sentQuotes: evaded.length,
    openedQuotes: opened.length,
    confirmedQuotes: confirmed.length,
    lostQuotes: activeQuotes.filter((quote) => quote.status === "perso_non_disponibile").length,
    conversionRate: activeQuotes.length ? Math.round((confirmed.length / activeQuotes.length) * 100) : 0,
    whatsappClicks: activeWhatsappClicks,
    confirmedValue: confirmed.reduce((sum, quote) => sum + quote.totalPrice, 0)
  };
}
