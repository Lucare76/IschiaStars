import { allDemoQuoteRequests, allDemoQuotes, allQuoteEvents } from "@/lib/demo-store";
import { formatDateRome, formatDateTimeRome, isStayExpiredRome } from "@/lib/date-format";
import { hasReliableQuoteTracking } from "@/lib/follow-up-policy";
import { adminQuoteWhatsappMessage } from "@/lib/message-templates";
import { getEffectiveHotelOptions } from "@/lib/repositories/shared";
import { Quote } from "@/lib/types";

type PublicQuoteUrlTarget = {
  code: string;
  token: string;
  publicShortCode?: string;
};

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(value);
}

export function formatClientName(firstName: string, lastName?: string | null): string {
  const cleanLast = lastName?.trim();
  if (!cleanLast || cleanLast.toLowerCase() === "cognome" || cleanLast.toLowerCase() === "xxx") {
    return firstName.trim();
  }
  return `${firstName.trim()} ${cleanLast}`;
}

export function formatDate(value: string) {
  return formatDateRome(value);
}

export function formatDateTime(value: string) {
  return formatDateTimeRome(value);
}

export function publicQuoteUrl(quote: PublicQuoteUrlTarget, params: Record<string, string | undefined> = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  const suffix = query.toString();
  return `/preventivi/${quote.code}/${quote.token}${suffix ? `?${suffix}` : ""}`;
}

export function siteBaseUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:4000").replace(/\/+$/, "");
}

export function absolutePublicQuoteUrl(quote: PublicQuoteUrlTarget, params: Record<string, string | undefined> = {}) {
  return `${siteBaseUrl()}${publicQuoteUrl(quote, params)}`;
}

export function whatsappQuoteBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_WHATSAPP_QUOTE_BASE_URL
    || process.env.NEXT_PUBLIC_SITE_URL
    || (process.env.NODE_ENV === "production" ? "https://preventivi.ischiastars.it" : "http://localhost:4000");
  const normalized = new URL(configured);
  if (normalized.hostname === "www.preventivi.ischiastars.it") normalized.hostname = "preventivi.ischiastars.it";
  if (normalized.hostname !== "localhost" && normalized.hostname !== "127.0.0.1") normalized.protocol = "https:";
  normalized.pathname = "";
  normalized.search = "";
  normalized.hash = "";
  return normalized.toString().replace(/\/+$/, "");
}

export function shortPublicQuoteUrl(quote: PublicQuoteUrlTarget) {
  const shortCode = quote.publicShortCode?.trim();
  return shortCode ? `/p/${encodeURIComponent(shortCode)}` : publicQuoteUrl(quote);
}

export function absoluteShortPublicQuoteUrl(quote: PublicQuoteUrlTarget) {
  return `${whatsappQuoteBaseUrl()}${shortPublicQuoteUrl(quote)}`;
}

export function normalizeItalianPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("39")) return digits;
  if (digits.startsWith("00")) return digits.slice(2);
  return `39${digits}`;
}
export function whatsappQuoteMessage(quote: Quote) {
  const options = getEffectiveHotelOptions(quote);
  return adminQuoteWhatsappMessage({
    quote,
    options,
    quoteUrl: absoluteShortPublicQuoteUrl(quote),
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
    whatsappClicks: events.filter((event) => event.eventType === "whatsapp_clicked" && isCustomerWhatsappEvent(event)).length,
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
  const sentUnconfirmed = quotes.filter((quote) => quote.status === "preventivo_inviato" && !confirmedIds.has(quote.id));
  const expired = sentUnconfirmed.filter((quote) => isStayExpiredRome(quote.departureDate));
  const evaded = sentUnconfirmed.filter((quote) => !isStayExpiredRome(quote.departureDate));
  const openedQuoteIds = new Set(events.filter((event) => event.eventType === "quote_opened").map((event) => event.quoteId));
  const unopened = evaded.filter((quote) => hasReliableQuoteTracking(quote.sentAt ?? quote.createdAt) && !openedQuoteIds.has(quote.id));
  return {
    createdQuotes: quotes.length,
    pendingRequests: quoteRequests.filter((request) => request.status === "da_evadere").length,
    sentQuotes: evaded.length,
    expiredQuotes: expired.length,
    openedQuotes: evaded.filter((quote) => openedQuoteIds.has(quote.id)).length,
    unopenedQuotes: unopened.length,
    toContactToday: unopened.filter((quote) => Date.now() - new Date(quote.sentAt ?? quote.createdAt).getTime() >= 24 * 60 * 60 * 1000).length,
    confirmedQuotes: confirmed.length,
    lostQuotes: quotes.filter((quote) => quote.status === "perso_non_disponibile").length,
    conversionRate: quotes.length ? Math.round((confirmed.length / quotes.length) * 100) : 0,
    whatsappClicks: events.filter((event) => event.eventType === "whatsapp_clicked" && isCustomerWhatsappEvent(event)).length,
    confirmedValue: confirmed.reduce((sum, quote) => sum + quote.totalPrice, 0),
    depositReceivedValue: quotes.reduce((sum, quote) => {
      const c = quote.confirmation;
      if (!c?.depositPaidAt) return sum;
      const deposit = c.selectedDepositAmount ?? 0;
      const balance = c.balancePaidAt ? (c.selectedBalanceAmount ?? 0) : 0;
      return sum + deposit + balance;
    }, 0)
  };
}

function isCustomerWhatsappEvent(event: { metadata?: Record<string, unknown> }) {
  const placement = typeof event.metadata?.placement === "string" ? event.metadata.placement : "";
  return placement !== "admin_quote_card";
}
