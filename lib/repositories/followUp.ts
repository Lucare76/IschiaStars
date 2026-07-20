import { getFollowUpEmailStatusByQuoteId, type FollowUpEmailStatus } from "@/lib/repositories/emailLogs";
import { getQuoteEventsForQuoteIds, trackableEvents } from "@/lib/repositories/quoteEvents";
import { listQuotes } from "@/lib/repositories/quotes";
import { listHotels } from "@/lib/repositories/hotels";
import { fetchHotelOptionsForQuotes } from "@/lib/repositories/quoteHotelOptions";
import { fallback, fromSupabase, getEffectiveHotelOptions, mapQuote, RepositoryResult } from "@/lib/repositories/shared";
import { followUpCustomerKey, followUpStage, followUpStageLabel, FollowUpStage, hasReliableQuoteTracking, isFollowUpStageDue } from "@/lib/follow-up-policy";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { absolutePublicQuoteUrl, absoluteShortPublicQuoteUrl, formatCurrency } from "@/lib/utils";
import type { Quote, QuoteEvent } from "@/lib/types";

export type FollowUpSegment = "non_visualizzato" | "aperto_non_confermato" | "molto_interessato" | "da_sollecitare" | "recente" | "storico_non_affidabile" | "chiuso";
export type FollowUpPriority = "alta" | "media" | "bassa";

export type FollowUpEmailInfo = {
  delivered: boolean;
  opened: boolean;
  clicked: boolean;
  problem: boolean;
  label: string;
  actionHint: string;
};

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
  whatsappMessage?: string;
  emailInfo: FollowUpEmailInfo;
};

export type FollowUpHotelClick = {
  hotelName: string;
  quoteCode: string;
  clickedAt: string;
  sourceUrl?: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const FOLLOW_UP_LOOKBACK_DAYS = 7;
export const FOLLOW_UP_PAGE_SIZE = 30;
export const FOLLOW_UP_MAX_LIMIT = 120;

type FollowUpQuotesData = {
  quotes: FollowUpQuote[];
  hasMore: boolean;
  limit: number;
};

const FOLLOW_UP_QUOTE_SELECT = [
  "id",
  "code",
  "public_token",
  "public_short_code",
  "quote_request_id",
  "status",
  "client_first_name",
  "client_last_name",
  "client_email",
  "client_phone",
  "hotel_requested",
  "hotel_id",
  "alternative_hotel_id",
  "is_alternative_offer",
  "check_in",
  "check_out",
  "adults",
  "rooms",
  "treatment",
  "total_price",
  "deposit_amount",
  "valid_until",
  "included_services",
  "transport_offers",
  "payment_policy",
  "cancellation_policy",
  "internal_notes",
  "public_notes",
  "created_at",
  "excluded_from_stats",
  "deleted_at",
  "metadata",
  "confirmed_at"
].join(",");

export async function getFollowUpQuotes(options: { limit?: number } = {}): Promise<RepositoryResult<FollowUpQuotesData>> {
  const resultLimit = normalizeFollowUpLimit(options.limit);
  const fetchLimit = Math.min(resultLimit + 1, FOLLOW_UP_MAX_LIMIT + 1);
  const candidateLimit = Math.min(Math.max(fetchLimit * 3, FOLLOW_UP_PAGE_SIZE * 3), FOLLOW_UP_MAX_LIMIT * 3);
  const quotesResult = await getRecentFollowUpCandidateQuotes(candidateLimit);
  const now = Date.now();
  const quoteIds = quotesResult.data.map((quote) => quote.id);
  const [eventsResult, emailStatusByQuote] = await Promise.all([
    getQuoteEventsForQuoteIds(quoteIds),
    getFollowUpEmailStatusByQuoteId(quoteIds)
  ]);
  const confirmedCustomerKeys = new Set(
    quotesResult.data
      .filter(hasActiveConfirmedBooking)
      .map(followUpCustomerKey)
      .filter(Boolean)
  );
  const mapped = quotesResult.data.map((quote) => toFollowUpQuote(quote, eventsResult.data[quote.id] ?? [], confirmedCustomerKeys, emailStatusByQuote[quote.id]));
  const allData = mapped
    .filter((quote): quote is FollowUpQuote => Boolean(quote))
    .filter((quote) => isRecentOperationalFollowUp(quote, now))
    .sort(compareFollowUpQuotes);
  const data = {
    quotes: allData.slice(0, resultLimit),
    hasMore: allData.length > resultLimit && resultLimit < FOLLOW_UP_MAX_LIMIT,
    limit: resultLimit
  };

  const error = [quotesResult.error, eventsResult.error].filter(Boolean).join(" | ") || undefined;
  return quotesResult.source === "supabase" && eventsResult.source === "supabase"
    ? fromSupabase(data)
    : fallback(data, error);
}

function normalizeFollowUpLimit(value?: number) {
  const numeric = Number.isFinite(value) ? Number(value) : FOLLOW_UP_PAGE_SIZE;
  const bounded = Math.min(Math.max(numeric, FOLLOW_UP_PAGE_SIZE), FOLLOW_UP_MAX_LIMIT);
  return Math.ceil(bounded / FOLLOW_UP_PAGE_SIZE) * FOLLOW_UP_PAGE_SIZE;
}

async function getRecentFollowUpCandidateQuotes(candidateLimit: number): Promise<RepositoryResult<Quote[]>> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return listQuotes({ includeDeleted: false });
  const db = supabase;

  const cutoffIso = new Date(Date.now() - FOLLOW_UP_LOOKBACK_DAYS * DAY_MS).toISOString();
  const todayIso = new Date().toISOString().slice(0, 10);
  const recentRowsResult = await baseFollowUpQuoteQuery(todayIso)
    .gte("created_at", cutoffIso)
    .order("created_at", { ascending: false })
    .limit(candidateLimit);

  if (recentRowsResult.error) return fallback([], recentRowsResult.error);

  const rows = rowsFromSupabase(recentRowsResult.data)
    .sort((a, b) => new Date(String(b.created_at ?? "")).getTime() - new Date(String(a.created_at ?? "")).getTime())
    .slice(0, candidateLimit);
  const quoteIds = rows.map((row) => String(row.id));
  const confirmedQuoteIds = await getConfirmedFollowUpQuoteIds(quoteIds);
  const activeRows = rows.filter((row) => !confirmedQuoteIds.has(String(row.id)));
  const activeQuoteIds = activeRows.map((row) => String(row.id));
  const [hotelResult, hotelOptionsMap] = await Promise.all([
    listHotels(),
    fetchHotelOptionsForQuotes(activeQuoteIds)
  ]);

  return fromSupabase(activeRows.map((row) => mapQuote(row, hotelResult.data, [], hotelOptionsMap[String(row.id)] ?? [])));

  function baseFollowUpQuoteQuery(minCheckIn: string) {
    return db
      .from("quotes")
      .select(FOLLOW_UP_QUOTE_SELECT)
      .eq("status", "preventivo_inviato")
      .is("deleted_at", null)
      .eq("excluded_from_stats", false)
      .gte("check_in", minCheckIn);
  }
}

async function getConfirmedFollowUpQuoteIds(quoteIds: string[]) {
  const supabase = createSupabaseAdminClient();
  const confirmed = new Set<string>();
  if (!supabase || !quoteIds.length) return confirmed;

  for (const chunk of chunkArray(quoteIds, 100)) {
    const { data } = await supabase
      .from("quote_confirmations")
      .select("quote_id")
      .in("quote_id", chunk);
    for (const row of data ?? []) confirmed.add(String(row.quote_id));
  }
  return confirmed;
}

function isRecentOperationalFollowUp(quote: FollowUpQuote, now = Date.now()) {
  const cutoff = now - FOLLOW_UP_LOOKBACK_DAYS * DAY_MS;
  const sentTimestamp = new Date(quote.sentAt).getTime();
  return Number.isFinite(sentTimestamp) && sentTimestamp >= cutoff;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function rowsFromSupabase(data: unknown): Record<string, unknown>[] {
  return Array.isArray(data) ? data as Record<string, unknown>[] : [];
}

function toFollowUpQuote(quote: Quote, events: QuoteEvent[], confirmedCustomerKeys: Set<string>, emailStatus?: FollowUpEmailStatus): FollowUpQuote | null {
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
  const contactEvents = followUpEvents.filter((event) => ["whatsapp", "email", "called", "solicited"].includes(String(event.metadata?.action ?? "")));
  const lastFollowUp = latestEvent(contactEvents);
  const snoozedUntil = latestSnoozeUntil(followUpEvents);
  const isClosed = followUpEvents.some((event) => event.metadata?.action === "closed");
  const lastEvent = latestEvent(customerEvents);
  const publicUrl = absolutePublicQuoteUrl(quote);
  const whatsappPublicUrl = absoluteShortPublicQuoteUrl(quote);
  const emailLinkClicks = customerEvents.filter((event) => event.eventType === "email_link_clicked");
  const lastCustomerEvent = latestEvent([
    ...opened,
    ...whatsappClicks,
    ...hotelLinkClicks,
    ...detailsOpened,
    ...confirmClicks,
    ...emailLinkClicks
  ]);
  const lastCustomerActivityAt = lastCustomerEvent?.createdAt ?? sentAt;
  const snoozeExpired = Boolean(snoozedUntil && new Date(snoozedUntil).getTime() <= Date.now());

  if (isClosed) return null;
  if (snoozedUntil && new Date(snoozedUntil).getTime() > Date.now()) return null;
  if (lastFollowUp && new Date(lastFollowUp.createdAt).getTime() >= new Date(lastCustomerActivityAt).getTime() && !snoozeExpired) return null;

  const emailInfo = resolveEmailInfo(emailStatus, opened.length > 0);
  const segment = isClosed ? "chiuso" : !isTrackingReliable && opened.length === 0 ? "storico_non_affidabile" : resolveSegment({
    sentAt,
    opened,
    whatsappClicks,
    hotelLinkClicks,
    printClicks,
    confirmClicks,
    detailsOpened,
    emailLinkClicks,
    emailStatus
  });
  const clientName = [quote.customerFirstName, quote.customerLastName].filter(Boolean).join(" ").trim() || "Cliente";
  const clientPhone = quote.customerPhone.trim();
  const engagementScore = scoreEngagement({ opened, whatsappClicks, hotelLinkClicks, printClicks, confirmClicks, detailsOpened, emailStatus });
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
    whatsappMessage: clientPhone ? followUpMessage(quote.customerFirstName, whatsappPublicUrl) : undefined,
    emailInfo
  };
}

function resolveSegment({
  sentAt,
  opened,
  whatsappClicks,
  hotelLinkClicks,
  printClicks,
  confirmClicks,
  detailsOpened,
  emailLinkClicks,
  emailStatus
}: {
  sentAt: string;
  opened: QuoteEvent[];
  whatsappClicks: QuoteEvent[];
  hotelLinkClicks: QuoteEvent[];
  printClicks: QuoteEvent[];
  confirmClicks: QuoteEvent[];
  detailsOpened: QuoteEvent[];
  emailLinkClicks: QuoteEvent[];
  emailStatus?: FollowUpEmailStatus;
}): FollowUpSegment {
  const lastOpening = opened.at(-1)?.createdAt;
  const isVeryInterested = opened.length > 1 || whatsappClicks.length > 0 || hotelLinkClicks.length > 0 || printClicks.length > 0 || confirmClicks.length > 0 || detailsOpened.length > 0 || emailLinkClicks.length > 0 || emailStatus?.clicked;
  if (isVeryInterested) return "molto_interessato";
  if (lastOpening && hoursSince(lastOpening) >= 24) return "da_sollecitare";
  if (opened.length > 0) return "aperto_non_confermato";
  if (hoursSince(sentAt) >= 24) return "non_visualizzato";
  return "recente";
}

export function followUpMessage(firstName: string, publicUrl: string) {
  const greeting = firstName.trim() ? `Salve ${firstName.trim()},` : "Salve,";
  return `${greeting}
solo un rapido promemoria: ha avuto modo di valutare la proposta per il suo soggiorno a Ischia?

Può rivedere il preventivo qui:
${publicUrl}

Se Le interessa Le consiglio di confermare al più presto, perché la disponibilità è in continuo aggiornamento e potrebbe presto terminare.

Resto a disposizione! 🌴
Diego`;
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

function resolveEmailInfo(emailStatus: FollowUpEmailStatus | undefined, hasPageOpening: boolean): FollowUpEmailInfo {
  if (!emailStatus) return { delivered: false, opened: false, clicked: false, problem: false, label: "", actionHint: "" };

  if (emailStatus.problem) {
    return { delivered: false, opened: false, clicked: false, problem: true, label: "Email preventivo non consegnata", actionHint: "Contatta via WhatsApp" };
  }
  if (emailStatus.clicked) {
    return { delivered: true, opened: true, clicked: true, problem: false, label: "Link preventivo cliccato da email", actionHint: "Richiamare" };
  }
  if (emailStatus.opened && !hasPageOpening) {
    return { delivered: true, opened: true, clicked: false, problem: false, label: "Email preventivo aperta, pagina non vista", actionHint: "Invia WhatsApp con link" };
  }
  if (emailStatus.opened) {
    return { delivered: true, opened: true, clicked: false, problem: false, label: "Email preventivo aperta", actionHint: "" };
  }
  if (emailStatus.delivered && !hasPageOpening) {
    return { delivered: true, opened: false, clicked: false, problem: false, label: "Email preventivo consegnata, non aperta", actionHint: "Follow-up soft" };
  }
  if (emailStatus.delivered) {
    return { delivered: true, opened: false, clicked: false, problem: false, label: "Email preventivo consegnata", actionHint: "" };
  }
  return { delivered: false, opened: false, clicked: false, problem: false, label: "", actionHint: "" };
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
    amounts_updated: "Importi aggiornati",
    email_link_clicked: "Click link email"
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
  detailsOpened,
  emailStatus
}: {
  opened: QuoteEvent[];
  whatsappClicks: QuoteEvent[];
  hotelLinkClicks: QuoteEvent[];
  printClicks: QuoteEvent[];
  confirmClicks: QuoteEvent[];
  detailsOpened: QuoteEvent[];
  emailStatus?: FollowUpEmailStatus;
}) {
  let score = opened.length + (whatsappClicks.length * 4) + (hotelLinkClicks.length * 3) + (printClicks.length * 3) + (confirmClicks.length * 6) + (detailsOpened.length * 2);
  if (emailStatus) {
    if (emailStatus.delivered) score += 1;
    if (emailStatus.opened) score += 2;
    if (emailStatus.clicked) score += 4;
  }
  return score;
}

function compareFollowUpQuotes(a: FollowUpQuote, b: FollowUpQuote) {
  return new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime() ||
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
