import { getQuoteEventsForQuoteIds, trackableEvents } from "@/lib/repositories/quoteEvents";
import { listQuotes } from "@/lib/repositories/quotes";
import { fallback, fromSupabase, getEffectiveHotelOptions, RepositoryResult } from "@/lib/repositories/shared";
import { followUpCustomerKey, followUpStage, followUpStageLabel, FollowUpStage, hasReliableQuoteTracking, isFollowUpStageDue } from "@/lib/follow-up-policy";
import { absolutePublicQuoteUrl, absoluteShortPublicQuoteUrl, formatCurrency, normalizeItalianPhone } from "@/lib/utils";
import type { Quote, QuoteEvent } from "@/lib/types";

export type FollowUpSegment = "non_visualizzato" | "aperto_non_confermato" | "molto_interessato" | "da_sollecitare" | "recente" | "storico_non_affidabile" | "chiuso";
export type FollowUpPriority = "alta" | "media" | "bassa";

export type FollowUpQuote = {
  id: string;
  code: string;
  token: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  createdAt: string;
  sentAt: string;
  arrivalDate: string;
  departureDate: string;
  lastEventAt?: string;
  lastEventLabel: string;
  lastOpenedAt?: string;
  openingSources: string[];
  openedCount: number;
  whatsappClickCount: number;
  hotelLinkClickCount: number;
  hotelLinkClicks: FollowUpHotelClick[];
  printClickCount: number;
  confirmClickCount: number;
  followUpCount: number;
  engagementScore: number;
  lastFollowUpAt?: string;
  snoozedUntil?: string;
  stage: FollowUpStage;
  stageLabel: string;
  isTrackingReliable: boolean;
  isClosed: boolean;
  segment: FollowUpSegment;
  segmentLabel: string;
  priority: FollowUpPriority;
  expiresSoon: boolean;
  hotelsSummary: string;
  mainOffer: string;
  publicUrl: string;
  whatsappHref?: string;
};

export type FollowUpHotelClick = {
  hotelName: string;
  quoteCode: string;
  clickedAt: string;
  sourceUrl?: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export async function getFollowUpQuotes(): Promise<RepositoryResult<FollowUpQuote[]>> {
  const quotesResult = await listQuotes({ includeDeleted: false });
  const quoteIds = quotesResult.data.map((quote) => quote.id);
  const eventsResult = await getQuoteEventsForQuoteIds(quoteIds);
  const confirmedCustomerKeys = new Set(
    quotesResult.data
      .filter(hasActiveConfirmedBooking)
      .map(followUpCustomerKey)
      .filter(Boolean)
  );
  const mapped = quotesResult.data.map((quote) => toFollowUpQuote(quote, eventsResult.data[quote.id] ?? [], confirmedCustomerKeys));
  const data = mapped
    .filter((quote): quote is FollowUpQuote => Boolean(quote))
    .sort(compareFollowUpQuotes);

  const error = [quotesResult.error, eventsResult.error].filter(Boolean).join(" | ") || undefined;
  return quotesResult.source === "supabase" && eventsResult.source === "supabase"
    ? fromSupabase(data)
    : fallback(data, error);
}

function toFollowUpQuote(quote: Quote, events: QuoteEvent[], confirmedCustomerKeys: Set<string>): FollowUpQuote | null {
  if (quote.deletedAt || quote.excludedFromStats || quote.status !== "preventivo_inviato" || quote.confirmation) return null;
  const customerKey = followUpCustomerKey(quote);
  if (customerKey && confirmedCustomerKeys.has(customerKey)) return null;

  const nights = Math.round((new Date(quote.departureDate).getTime() - new Date(quote.arrivalDate).getTime()) / DAY_MS);
  if (nights < 4) return null;

  if (new Date(quote.arrivalDate).getTime() < Date.now()) return null;

  const sentAt = quote.sentAt ?? quote.createdAt;
  const isTrackingReliable = hasReliableQuoteTracking(sentAt);
  const sentTimestamp = new Date(sentAt).getTime();
  const customerEvents = trackableEvents(events).filter((event) => new Date(event.createdAt).getTime() >= sentTimestamp);

  if (customerEvents.some((event) => event.eventType === "quote_confirmed")) return null;

  const opened = customerEvents.filter((event) => event.eventType === "quote_opened");
  const whatsappClicks = customerEvents.filter((event) => event.eventType === "whatsapp_clicked" && isCustomerWhatsappEvent(event));
  const hotelLinkClicks = customerEvents.filter((event) => event.eventType === "hotel_link_clicked");
  const printClicks = customerEvents.filter((event) => event.eventType === "print_clicked");
  const confirmClicks = customerEvents.filter((event) => event.eventType === "confirm_clicked");
  const detailsOpened = customerEvents.filter((event) => event.eventType === "details_opened");
  const followUpEvents = customerEvents.filter((event) => event.eventType === "follow_up_whatsapp_click");
  const contactEvents = followUpEvents.filter((event) => ["whatsapp", "called", "solicited"].includes(String(event.metadata?.action ?? "")));
  const lastFollowUp = latestEvent(contactEvents);
  const snoozedUntil = latestSnoozeUntil(followUpEvents);
  const isClosed = followUpEvents.some((event) => event.metadata?.action === "closed");
  const lastEvent = latestEvent(customerEvents);
  const publicUrl = absolutePublicQuoteUrl(quote);
  const whatsappPublicUrl = absoluteShortPublicQuoteUrl(quote);
  const segment = isClosed ? "chiuso" : !isTrackingReliable && opened.length === 0 ? "storico_non_affidabile" : resolveSegment({
    sentAt,
    opened,
    whatsappClicks,
    hotelLinkClicks,
    printClicks,
    confirmClicks,
    detailsOpened
  });
  const clientName = [quote.customerFirstName, quote.customerLastName].filter(Boolean).join(" ").trim() || "Cliente";
  const clientPhone = quote.customerPhone.trim();
  const engagementScore = scoreEngagement({ opened, whatsappClicks, hotelLinkClicks, printClicks, confirmClicks, detailsOpened });
  const stage = followUpStage(sentAt);

  return {
    id: quote.id,
    code: quote.code,
    token: quote.token,
    clientName,
    clientPhone,
    clientEmail: quote.customerEmail,
    createdAt: quote.createdAt,
    sentAt,
    arrivalDate: quote.arrivalDate,
    departureDate: quote.departureDate,
    lastEventAt: lastEvent?.createdAt,
    lastEventLabel: lastEvent ? eventLabel(lastEvent.eventType) : "Nessuna visualizzazione tracciata",
    lastOpenedAt: opened.at(-1)?.createdAt,
    openingSources: openingSourceLabels(opened),
    openedCount: opened.length,
    whatsappClickCount: whatsappClicks.length,
    hotelLinkClickCount: hotelLinkClicks.length,
    hotelLinkClicks: hotelLinkClicks.map((event) => ({
      hotelName: typeof event.metadata?.hotelName === "string" ? event.metadata.hotelName : "Hotel non identificato",
      quoteCode: quote.code,
      clickedAt: event.createdAt,
      sourceUrl: typeof event.metadata?.sourceUrl === "string" ? event.metadata.sourceUrl : undefined
    })),
    printClickCount: printClicks.length,
    confirmClickCount: confirmClicks.length,
    followUpCount: followUpEvents.length,
    engagementScore,
    lastFollowUpAt: lastFollowUp?.createdAt,
    snoozedUntil,
    stage,
    stageLabel: followUpStageLabel(stage),
    isTrackingReliable,
    isClosed,
    segment,
    segmentLabel: segmentLabel(segment),
    priority: priorityFor(segment),
    expiresSoon: isExpiresSoon(quote.offerExpiresAt),
    hotelsSummary: summarizeHotels(quote),
    mainOffer: summarizeMainOffer(quote),
    publicUrl,
    whatsappHref: clientPhone ? followUpWhatsappHref(clientPhone, followUpMessage(segment, stage, clientName, whatsappPublicUrl)) : undefined
  };
}

function resolveSegment({
  sentAt,
  opened,
  whatsappClicks,
  hotelLinkClicks,
  printClicks,
  confirmClicks,
  detailsOpened
}: {
  sentAt: string;
  opened: QuoteEvent[];
  whatsappClicks: QuoteEvent[];
  hotelLinkClicks: QuoteEvent[];
  printClicks: QuoteEvent[];
  confirmClicks: QuoteEvent[];
  detailsOpened: QuoteEvent[];
}): FollowUpSegment {
  const lastOpening = opened.at(-1)?.createdAt;
  const isVeryInterested = opened.length > 1 || whatsappClicks.length > 0 || hotelLinkClicks.length > 0 || printClicks.length > 0 || confirmClicks.length > 0 || detailsOpened.length > 0;
  if (isVeryInterested) return "molto_interessato";
  if (lastOpening && hoursSince(lastOpening) >= 24) return "da_sollecitare";
  if (opened.length > 0) return "aperto_non_confermato";
  if (hoursSince(sentAt) >= 24) return "non_visualizzato";
  return "recente";
}

function followUpMessage(segment: FollowUpSegment, stage: FollowUpStage, clientName: string, publicUrl: string) {
  const firstName = clientName.split(" ")[0] || "ciao";
  if (segment === "non_visualizzato" && stage === "primo_sollecito") {
    return `Ciao ${firstName}, ti abbiamo inviato le proposte per il tuo soggiorno a Ischia. Ti lascio di nuovo il link: ${publicUrl}. Se vuoi ti aiuto a scegliere la soluzione più adatta.`;
  }
  if (segment === "non_visualizzato" && stage === "secondo_sollecito") {
    return `Ciao ${firstName}, volevo assicurarmi che il preventivo per Ischia ti fosse arrivato correttamente. Puoi visualizzarlo qui: ${publicUrl}. Se vuoi modificare date, struttura o trattamento, scrivimi pure.`;
  }
  if (segment === "non_visualizzato" && stage === "ultimo_contatto") {
    return `Ciao ${firstName}, ti ricontatto un'ultima volta per il preventivo richiesto per Ischia. Se sei ancora interessato trovi qui tutte le proposte: ${publicUrl}. Resto a disposizione per qualsiasi modifica.`;
  }
  if (segment === "molto_interessato") {
    return `Ciao ${firstName}, ho visto che hai guardato più volte il preventivo. La soluzione che ti interessa potrebbe non restare disponibile a lungo: se vuoi la blocchiamo insieme. Ti lascio il link: ${publicUrl}.`;
  }
  return `Ciao ${firstName}, ho visto che hai consultato le proposte. Se hai dubbi posso aiutarti a scegliere la struttura più adatta. Ti lascio il link: ${publicUrl}.`;
}

function followUpWhatsappHref(phone: string, message: string) {
  return `https://wa.me/${normalizeItalianPhone(phone)}?text=${encodeURIComponent(message)}`;
}

function latestEvent(events: QuoteEvent[]) {
  return [...events].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).at(-1);
}

function isCustomerWhatsappEvent(event: QuoteEvent) {
  const placement = typeof event.metadata?.placement === "string" ? event.metadata.placement : "";
  return placement !== "admin_quote_card";
}

function latestSnoozeUntil(events: QuoteEvent[]) {
  return events
    .map((event) => typeof event.metadata?.snoozed_until === "string" ? event.metadata.snoozed_until : undefined)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
}

function hoursSince(value: string) {
  return (Date.now() - new Date(value).getTime()) / (60 * 60 * 1000);
}

function isExpiresSoon(value: string) {
  const expiresAt = new Date(value).getTime();
  if (!Number.isFinite(expiresAt)) return false;
  const diff = expiresAt - Date.now();
  return diff >= 0 && diff <= 3 * DAY_MS;
}

function summarizeHotels(quote: Quote) {
  const names = Array.from(new Set(getEffectiveHotelOptions(quote).map((option) => option.hotelName).filter(Boolean)));
  return names.slice(0, 3).join(", ") + (names.length > 3 ? ` +${names.length - 3}` : "");
}

function summarizeMainOffer(quote: Quote) {
  const option = getEffectiveHotelOptions(quote)[0];
  const treatment = option?.treatments[0];
  if (!option || !treatment) return quote.treatment ? `${quote.treatment} · ${formatCurrency(quote.totalPrice)}` : formatCurrency(quote.totalPrice);
  const room = option.roomTypeLabel ? `${option.roomTypeLabel} · ` : "";
  return `${room}${treatment.label} · ${formatCurrency(treatment.price)}`;
}

function eventLabel(eventType: QuoteEvent["eventType"]) {
  const labels: Record<QuoteEvent["eventType"], string> = {
    quote_opened: "Preventivo aperto",
    whatsapp_clicked: "Click WhatsApp cliente",
    confirm_clicked: "Click conferma",
    quote_confirmed: "Confermato",
    print_clicked: "Stampa/PDF",
    hotel_link_clicked: "Click hotel",
    details_opened: "Dettagli aperti",
    availability_confirmed: "Disponibilità confermata",
    final_confirmation_email_sent: "Conferma definitiva inviata",
    deposit_due_at_set: "Scadenza caparra impostata",
    availability_unavailable: "Disponibilità terminata",
    availability_unavailable_email_sent: "Email disponibilità terminata",
    alternative_to_propose: "Alternativa da proporre",
    follow_up_whatsapp_click: "Follow-up WhatsApp",
    compare_opened: "Vista confronto aperta",
    reveal_options_clicked: "Altre proposte rivelate su mobile",
    hesitant_whatsapp_clicked: "Click WhatsApp (cliente indeciso)",
    supplier_confirmation_sent: "Conferma inviata a hotel/agenzia",
    reaction_interested: "Ha indicato interesse",
    reaction_too_expensive: "Ha indicato prezzo alto",
    amounts_updated: "Importi aggiornati"
  };
  return labels[eventType];
}

function segmentLabel(segment: FollowUpSegment) {
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

function priorityFor(segment: FollowUpSegment): FollowUpPriority {
  if (segment === "molto_interessato" || segment === "da_sollecitare") return "alta";
  if (segment === "non_visualizzato" || segment === "aperto_non_confermato") return "media";
  return "bassa";
}

function openingSourceLabels(opened: QuoteEvent[]) {
  const labels = opened.map((event) => {
    const source = typeof event.metadata?.source === "string" ? event.metadata.source : "";
    if (source === "whatsapp_quote_link") return "WhatsApp";
    if (source === "email_quote_link") return "Email";
    return "Link diretto";
  });
  return Array.from(new Set(labels));
}

function priorityWeight(priority: FollowUpPriority) {
  return priority === "alta" ? 3 : priority === "media" ? 2 : 1;
}

function scoreEngagement({
  opened,
  whatsappClicks,
  hotelLinkClicks,
  printClicks,
  confirmClicks,
  detailsOpened
}: {
  opened: QuoteEvent[];
  whatsappClicks: QuoteEvent[];
  hotelLinkClicks: QuoteEvent[];
  printClicks: QuoteEvent[];
  confirmClicks: QuoteEvent[];
  detailsOpened: QuoteEvent[];
}) {
  return opened.length + (whatsappClicks.length * 4) + (hotelLinkClicks.length * 3) + (printClicks.length * 3) + (confirmClicks.length * 6) + (detailsOpened.length * 2);
}

function compareFollowUpQuotes(a: FollowUpQuote, b: FollowUpQuote) {
  return b.engagementScore - a.engagementScore ||
    priorityWeight(b.priority) - priorityWeight(a.priority) ||
    new Date(b.lastEventAt ?? b.sentAt).getTime() - new Date(a.lastEventAt ?? a.sentAt).getTime();
}

function hasActiveConfirmedBooking(quote: Quote) {
  if (quote.deletedAt || quote.excludedFromStats) return false;
  if (quote.status !== "confermato" && !quote.confirmation) return false;
  return new Date(quote.departureDate).getTime() >= Date.now();
}

export function getDueFollowUpCustomerKeys(quotes: FollowUpQuote[], now = Date.now()) {
  const grouped = new Map<string, FollowUpQuote[]>();
  for (const quote of quotes) {
    const key = followUpCustomerKey(quote);
    if (!key) continue;
    grouped.set(key, [...(grouped.get(key) ?? []), quote]);
  }

  const dueKeys = new Set<string>();
  for (const [key, group] of Array.from(grouped.entries())) {
    const totalOpenings = group.reduce((sum, quote) => sum + quote.openedCount, 0);
    const engagementScore = group.reduce((sum, quote) => sum + quote.engagementScore, 0);
    if (followUpGroupSegment(group, totalOpenings, engagementScore, now) !== "non_visualizzato") continue;

    const snoozedUntil = group.map((quote) => quote.snoozedUntil).filter(Boolean).sort().at(-1);
    if (snoozedUntil && new Date(snoozedUntil).getTime() > now) continue;

    const lastFollowUpAt = group.map((quote) => quote.lastFollowUpAt).filter(Boolean).sort().at(-1);
    if (group.some((quote) => isFollowUpStageDue(quote.sentAt, lastFollowUpAt, now))) dueKeys.add(key);
  }
  return dueKeys;
}

export function followUpGroupSegment(
  quotes: FollowUpQuote[],
  totalOpenings: number,
  engagementScore: number,
  now = Date.now()
): FollowUpSegment {
  if (quotes.every((quote) => quote.isClosed)) return "chiuso";
  if (totalOpenings > 1 || engagementScore > totalOpenings) return "molto_interessato";
  const lastOpenedAt = quotes.map((quote) => quote.lastOpenedAt).filter((value): value is string => Boolean(value)).sort().at(-1);
  if (lastOpenedAt && now - new Date(lastOpenedAt).getTime() >= DAY_MS) return "da_sollecitare";
  if (totalOpenings > 0) return "aperto_non_confermato";
  if (quotes.every((quote) => !quote.isTrackingReliable)) return "storico_non_affidabile";
  if (quotes.every((quote) => quote.segment === "recente")) return "recente";
  return "non_visualizzato";
}
