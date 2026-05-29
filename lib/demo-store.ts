import { hotels, quoteEvents, quoteRequests, quotes } from "@/lib/mock-data";
import { Hotel, Quote, QuoteEvent, QuoteRequest, QuoteStatus } from "@/lib/types";

export type DemoQuoteStatusEvent = {
  id: string;
  quoteId: string;
  fromStatus?: string | null;
  toStatus: string;
  note?: string;
  createdAt: string;
};

type DemoStore = {
  events: QuoteEvent[];
  statusEvents: DemoQuoteStatusEvent[];
  confirmedQuoteIds: Set<string>;
  hotels: Hotel[];
  quotes: Quote[];
  quoteRequests: QuoteRequest[];
};

const globalStore = globalThis as typeof globalThis & { __ischiaStarsDemoStore?: DemoStore };

export function getDemoStore() {
  if (!globalStore.__ischiaStarsDemoStore) {
    globalStore.__ischiaStarsDemoStore = {
      events: [],
      statusEvents: [],
      confirmedQuoteIds: new Set<string>(),
      hotels: [...hotels],
      quotes: [...quotes],
      quoteRequests: [...quoteRequests]
    };
  }

  return globalStore.__ischiaStarsDemoStore;
}

export function allQuoteEvents() {
  return [...quoteEvents, ...getDemoStore().events];
}

export function allQuoteStatusEvents() {
  return [...getDemoStore().statusEvents];
}

export function allDemoHotels() {
  return getDemoStore().hotels;
}

export function allDemoQuotes() {
  return getDemoStore().quotes;
}

export function allDemoQuoteRequests() {
  return getDemoStore().quoteRequests;
}

export function upsertDemoHotel(hotel: Hotel) {
  const store = getDemoStore();
  const index = store.hotels.findIndex((item) => item.id === hotel.id);
  if (index >= 0) store.hotels[index] = hotel;
  else store.hotels.unshift(hotel);
  return hotel;
}

export function deleteDemoHotel(id: string) {
  const store = getDemoStore();
  const linked = store.quotes.some((quote) => quote.proposedHotel.id === id || quote.alternativeHotel?.id === id);
  if (linked) return { ok: false, reason: "Hotel collegato a preventivi: disattivalo invece di eliminarlo." };
  store.hotels = store.hotels.filter((hotel) => hotel.id !== id);
  return { ok: true };
}

export function addDemoQuote(quote: Quote) {
  getDemoStore().quotes.unshift(quote);
  return quote;
}

export function updateDemoQuoteRequestStatus(id: string, status: QuoteStatus) {
  const store = getDemoStore();
  const index = store.quoteRequests.findIndex((request) => request.id === id);
  if (index < 0) return null;
  store.quoteRequests[index] = { ...store.quoteRequests[index], status };
  return store.quoteRequests[index];
}

export function updateDemoQuote(id: string, updater: (quote: Quote) => Quote) {
  const store = getDemoStore();
  const index = store.quotes.findIndex((quote) => quote.id === id);
  if (index < 0) return null;
  store.quotes[index] = updater(store.quotes[index]);
  return store.quotes[index];
}

export function recordQuoteEvent(quoteId: string, eventType: QuoteEvent["eventType"], metadata: Record<string, unknown> = {}, userAgent?: string) {
  const quote = allDemoQuotes().find((item) => item.id === quoteId);
  if (!quote) return null;

  const event: QuoteEvent = {
    id: `local-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    quoteId,
    eventType,
    createdAt: new Date().toISOString(),
    metadata,
    userAgent
  };

  getDemoStore().events.push(event);
  return event;
}

export function recordQuoteStatusEvent(quoteId: string, fromStatus: string | null | undefined, toStatus: string, note?: string) {
  const event: DemoQuoteStatusEvent = {
    id: `local-status-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    quoteId,
    fromStatus,
    toStatus,
    note,
    createdAt: new Date().toISOString()
  };

  getDemoStore().statusEvents.push(event);
  return event;
}

export function markQuoteConfirmed(quoteId: string) {
  getDemoStore().confirmedQuoteIds.add(quoteId);
  recordQuoteEvent(quoteId, "quote_confirmed", { source: "local-confirmation-form" });
}

export function isQuoteConfirmedInDemo(quoteId: string) {
  return getDemoStore().confirmedQuoteIds.has(quoteId);
}

export function excludeDemoQuoteFromStats(quoteId: string, excluded: boolean) {
  return updateDemoQuote(quoteId, (quote) => ({ ...quote, excludedFromStats: excluded }));
}

export function softDeleteDemoQuote(quoteId: string, reason?: string) {
  return updateDemoQuote(quoteId, (quote) => ({
    ...quote,
    deletedAt: new Date().toISOString(),
    excludedFromStats: true,
    ...(reason ? {} : {})
  }));
}

export function restoreDemoQuote(quoteId: string) {
  return updateDemoQuote(quoteId, (quote) => ({ ...quote, deletedAt: undefined, excludedFromStats: false }));
}
