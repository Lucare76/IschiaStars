import { allDemoQuoteRequests, allDemoQuotes, allQuoteEvents } from "@/lib/demo-store";
import { formatDateRome, formatDateTimeRome } from "@/lib/date-format";
import { adminQuoteWhatsappMessage } from "@/lib/message-templates";
import { Quote } from "@/lib/types";

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(value);
}

export function formatDate(value: string) {
  return formatDateRome(value);
}

export function formatDateTime(value: string) {
  return formatDateTimeRome(value);
}

export function publicQuoteUrl(quote: Quote) {
  return `/preventivi/${quote.code}?token=${quote.token}`;
}

export function siteBaseUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:4000").replace(/\/+$/, "");
}

export function absolutePublicQuoteUrl(quote: Quote) {
  return `${siteBaseUrl()}${publicQuoteUrl(quote)}`;
}

export function normalizeItalianPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("39")) return digits;
  if (digits.startsWith("00")) return digits.slice(2);
  return `39${digits}`;
}
export function whatsappQuoteMessage(quote: Quote) {
  const hotelNames = Array.from(new Map(quote.hotelOptions.map((o) => [o.hotelGroup, o.hotelName])).values());
  const hasMultipleOptions = hotelNames.length > 1;
  const hotelLine = hasMultipleOptions ? hotelNames.join(" - ") : (hotelNames[0] ?? quote.proposedHotel.name);
  const dates = `${formatDate(quote.arrivalDate)} - ${formatDate(quote.departureDate)}`;
  return adminQuoteWhatsappMessage({
    quote,
    dates,
    hotelLine,
    quoteUrl: absolutePublicQuoteUrl(quote),
    hasMultipleOptions
  });
}

export function whatsappQuoteLink(quote: Quote) {
  return `https://wa.me/${normalizeItalianPhone(quote.customerPhone)}?text=${encodeURIComponent(whatsappQuoteMessage(quote))}`;
}
export function ischiastarsWhatsappNumber() {
  return (process.env.NEXT_PUBLIC_ISCHIASTARS_WHATSAPP || "393717590017").replace(/\D/g, "");
}

export function publicWhatsappLink(message: string) {
  return `https://wa.me/${ischiastarsWhatsappNumber()}?text=${encodeURIComponent(message)}`;
}

export function quoteEventStats(quoteId: string) {
  const events = allQuoteEvents().filter((event) => event.quoteId === quoteId);
  const openings = events.filter((event) => event.eventType === "quote_opened");
  return {
    openings: openings.length,
    lastOpening: openings.at(-1)?.createdAt,
    whatsappClicks: events.filter((event) => event.eventType === "whatsapp_clicked").length,
    confirmClicked: events.some((event) => event.eventType === "confirm_clicked"),
    confirmed: events.some((event) => event.eventType === "quote_confirmed")
  };
}

export function dashboardStats() {
  const quotes = allDemoQuotes().filter((quote) => !quote.deletedAt && !quote.excludedFromStats);
  const quoteRequests = allDemoQuoteRequests();
  const events = allQuoteEvents();
  const localConfirmedIds = new Set(events.filter((event) => event.eventType === "quote_confirmed").map((event) => event.quoteId));
  const confirmed = quotes.filter((quote) => quote.status === "confermato" || Boolean(quote.confirmation) || localConfirmedIds.has(quote.id));
  const confirmedIds = new Set(confirmed.map((quote) => quote.id));
  const evaded = quotes.filter((quote) => !confirmedIds.has(quote.id) && quote.status !== "perso_non_disponibile");
  const openedQuoteIds = new Set(events.filter((event) => event.eventType === "quote_opened").map((event) => event.quoteId));
  return {
    createdQuotes: quotes.length,
    pendingRequests: quoteRequests.filter((request) => request.status === "da_evadere").length,
    sentQuotes: evaded.length,
    openedQuotes: openedQuoteIds.size,
    confirmedQuotes: confirmed.length,
    lostQuotes: quotes.filter((quote) => quote.status === "perso_non_disponibile").length,
    conversionRate: quotes.length ? Math.round((confirmed.length / quotes.length) * 100) : 0,
    whatsappClicks: events.filter((event) => event.eventType === "whatsapp_clicked").length,
    confirmedValue: confirmed.reduce((sum, quote) => sum + quote.totalPrice, 0)
  };
}
