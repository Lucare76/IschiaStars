import { listQuoteRequests } from "@/lib/repositories/quoteRequests";
import { getDashboardEventStats } from "@/lib/repositories/quoteEvents";
import { listQuotes } from "@/lib/repositories/quotes";
import { fallback, fromSupabase, RepositoryResult } from "@/lib/repositories/shared";

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
  const [quotesResult, requestsResult, eventsResult] = await Promise.all([listQuotes(), listQuoteRequests(), getDashboardEventStats()]);
  const quotes = quotesResult.data;
  const events = eventsResult.data;
  const confirmed = quotes.filter((quote) => quote.status === "confermato" || events.confirmedEventIds.has(quote.id));
  const stats = {
    createdQuotes: quotes.length,
    pendingRequests: requestsResult.data.filter((request) => request.status === "da_evadere").length,
    sentQuotes: quotes.filter((quote) => quote.status === "preventivo_inviato").length,
    openedQuotes: events.openedQuoteIds.size,
    confirmedQuotes: confirmed.length,
    lostQuotes: quotes.filter((quote) => quote.status === "perso_non_disponibile").length,
    conversionRate: quotes.length ? Math.round((confirmed.length / quotes.length) * 100) : 0,
    whatsappClicks: events.whatsappClicks,
    confirmedValue: confirmed.reduce((sum, quote) => sum + quote.totalPrice, 0)
  };

  return quotesResult.source === "supabase" || requestsResult.source === "supabase" || eventsResult.source === "supabase" ? fromSupabase(stats) : fallback(stats);
}
