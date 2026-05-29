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
  const [quotesResult, requestsResult, eventsResult] = await Promise.all([
    listQuotes({ includeDeleted: false }),
    listQuoteRequests(),
    getDashboardEventStats()
  ]);

  // Solo preventivi attivi nelle statistiche: non cancellati e non esclusi
  const activeQuotes = quotesResult.data.filter((quote) => !quote.excludedFromStats);
  const activeIds = new Set(activeQuotes.map((quote) => quote.id));

  const events = eventsResult.data;

  // Filtra eventi per soli preventivi attivi
  const activeOpenedIds = new Set(Array.from(events.openedQuoteIds).filter((id) => activeIds.has(id)));
  const activeConfirmedIds = new Set(Array.from(events.confirmedEventIds).filter((id) => activeIds.has(id)));
  const activeWhatsappClicks = events.whatsappClickQuoteIds.filter((id) => activeIds.has(id)).length;

  const confirmed = activeQuotes.filter((quote) => quote.status === "confermato" || activeConfirmedIds.has(quote.id));

  const stats = {
    createdQuotes: activeQuotes.length,
    pendingRequests: requestsResult.data.filter((request) => request.status === "da_evadere").length,
    sentQuotes: activeQuotes.filter((quote) => quote.status === "preventivo_inviato").length,
    openedQuotes: activeOpenedIds.size,
    confirmedQuotes: confirmed.length,
    lostQuotes: activeQuotes.filter((quote) => quote.status === "perso_non_disponibile").length,
    conversionRate: activeQuotes.length ? Math.round((confirmed.length / activeQuotes.length) * 100) : 0,
    whatsappClicks: activeWhatsappClicks,
    confirmedValue: confirmed.reduce((sum, quote) => sum + quote.totalPrice, 0)
  };

  return quotesResult.source === "supabase" || requestsResult.source === "supabase" || eventsResult.source === "supabase"
    ? fromSupabase(stats)
    : fallback(stats);
}
