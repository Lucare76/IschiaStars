import "server-only";

import { allDemoQuotes, allQuoteEvents } from "@/lib/demo-store";
import { fallback, fromSupabase, RepositoryResult } from "@/lib/repositories/shared";
import { CUSTOMER_ACTIVITY_EVENT_TYPES, isCustomerActivityEvent } from "@/lib/server/trackingFilters";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { QuoteEvent } from "@/lib/types";

export const QUOTE_NOTIFICATIONS_SEEN_KEY = "quote_notifications_seen_at";
const NOTIFICATION_EVENT_SCAN_MULTIPLIER = 25;
const MIN_NOTIFICATION_EVENT_SCAN_LIMIT = 300;
const MAX_NOTIFICATION_EVENT_SCAN_LIMIT = 500;

export type QuoteNotificationType = "apertura" | "cliente_caldo" | "conferma" | "click" | "interesse";

export type QuoteNotification = {
  id: string;
  quoteId: string;
  quoteCode: string;
  customerName: string;
  type: QuoteNotificationType;
  createdAt: string;
  description: string;
  isRead: boolean;
  shouldPlaySound: boolean;
};

type QuoteNotificationSource = {
  id: string;
  code: string;
  customerName: string;
  isLabTest?: boolean;
};

export function deriveQuoteNotifications(
  events: QuoteEvent[],
  quotes: QuoteNotificationSource[],
  seenAt?: string
): QuoteNotification[] {
  const quoteById = new Map(quotes.filter((quote) => !quote.isLabTest).map((quote) => [quote.id, quote]));
  const seenTimestamp = seenAt ? Date.parse(seenAt) : Number.NaN;
  const openingCountByQuote = new Map<string, number>();

  return events
    .filter(isCustomerActivityEvent)
    // Una semplice apertura pagina può essere un reload, una tab ripristinata
    // o un link aperto da un dispositivo non identificabile con certezza.
    // La campanella deve segnalare solo attività intenzionali del cliente.
    .filter((event) => event.eventType !== "quote_opened")
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    .map((event) => {
      const quote = quoteById.get(event.quoteId);
      if (!quote) return null;

      const openingCount = event.eventType === "quote_opened"
        ? (openingCountByQuote.get(event.quoteId) ?? 0) + 1
        : openingCountByQuote.get(event.quoteId) ?? 0;
      if (event.eventType === "quote_opened") openingCountByQuote.set(event.quoteId, openingCount);

      const presentation = notificationPresentation(event, openingCount);
      return buildNotification(event, quote, presentation.type, presentation.description, seenTimestamp, presentation.shouldPlaySound);
    })
    .filter((notification): notification is QuoteNotification => Boolean(notification))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export async function getQuoteNotifications(limit = 20): Promise<RepositoryResult<QuoteNotification[]>> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    const quotes = allDemoQuotes().map((quote) => ({
      id: quote.id,
      code: quote.code,
      customerName: `${quote.customerFirstName} ${quote.customerLastName}`.trim(),
      isLabTest: quote.isLabTest
    }));
    return fallback(deriveQuoteNotifications(allQuoteEvents(), quotes).slice(0, limit));
  }

  const eventScanLimit = Math.min(
    Math.max(limit * NOTIFICATION_EVENT_SCAN_MULTIPLIER, MIN_NOTIFICATION_EVENT_SCAN_LIMIT),
    MAX_NOTIFICATION_EVENT_SCAN_LIMIT
  );
  const [{ data: eventRows, error: eventError }, { data: settingRow, error: settingError }] = await Promise.all([
    supabase
      .from("quote_events")
      .select("id,quote_id,event_type,created_at,user_agent,metadata")
      .in("event_type", CUSTOMER_ACTIVITY_EVENT_TYPES)
      .order("created_at", { ascending: false })
      .limit(eventScanLimit),
    supabase.from("settings").select("value").eq("key", QUOTE_NOTIFICATIONS_SEEN_KEY).maybeSingle()
  ]);

  const error = eventError ?? settingError;
  if (error) return fallback([], error);

  const events = (eventRows ?? []).map(mapEvent);
  const quoteIds = Array.from(new Set(events.map((event) => event.quoteId)));
  if (!quoteIds.length) return fromSupabase([]);

  const { data: quoteRows, error: quoteError } = await supabase
    .from("quotes")
    .select("id,code,client_first_name,client_last_name,metadata")
    .in("id", quoteIds);
  if (quoteError) return fallback([], quoteError);

  const quotes = (quoteRows ?? []).map((row) => ({
    id: String(row.id),
    code: String(row.code),
    customerName: `${String(row.client_first_name ?? "")} ${String(row.client_last_name ?? "")}`.trim(),
    isLabTest: row.metadata?.is_lab_test === true
  }));
  const seenAt = readSeenAt(settingRow?.value);

  return fromSupabase(deriveQuoteNotifications(events, quotes, seenAt).slice(0, limit));
}

export async function markQuoteNotificationsSeen(seenAt = new Date().toISOString()): Promise<RepositoryResult<string>> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return fallback(seenAt);

  const { error } = await supabase.from("settings").upsert({
    key: QUOTE_NOTIFICATIONS_SEEN_KEY,
    value: { seen_at: seenAt },
    updated_at: seenAt
  }, { onConflict: "key" });

  if (error) return fallback(seenAt, error);
  return fromSupabase(seenAt);
}

function notificationPresentation(event: QuoteEvent, openingCount: number): { type: QuoteNotificationType; description: string; shouldPlaySound: boolean } {
  if (event.eventType === "quote_opened") {
    if (openingCount >= 3) {
      return { type: "cliente_caldo", description: "sta guardando di nuovo - cliente caldo", shouldPlaySound: false };
    }
    return { type: "apertura", description: "ha aperto il preventivo", shouldPlaySound: openingCount === 1 };
  }
  if (event.eventType === "quote_confirmed") {
    const selectedHotel = typeof event.metadata?.selectedHotelName === "string" ? event.metadata.selectedHotelName.trim() : "";
    return { type: "conferma", description: selectedHotel ? `ha confermato ${selectedHotel}` : "ha confermato una proposta", shouldPlaySound: true };
  }
  const descriptions: Partial<Record<QuoteEvent["eventType"], string>> = {
    whatsapp_clicked: "ha cliccato WhatsApp",
    hesitant_whatsapp_clicked: "ha chiesto aiuto su WhatsApp",
    hotel_link_clicked: "ha aperto la pagina hotel",
    print_clicked: "ha aperto stampa/PDF",
    details_opened: "ha aperto i dettagli dell'offerta",
    confirm_clicked: "ha cliccato conferma",
    compare_opened: "ha confrontato le proposte",
    reveal_options_clicked: "ha visualizzato altre proposte",
    reaction_interested: "ha indicato interesse",
    reaction_too_expensive: "ha indicato prezzo troppo alto",
    email_link_clicked: "ha cliccato un link nell'email"
  };
  return {
    type: event.eventType.startsWith("reaction_") ? "interesse" : "click",
    description: descriptions[event.eventType] ?? "ha interagito con il preventivo",
    shouldPlaySound: false
  };
}

function buildNotification(
  event: QuoteEvent,
  quote: QuoteNotificationSource,
  type: QuoteNotificationType,
  description: string,
  seenTimestamp: number,
  shouldPlaySound: boolean
): QuoteNotification {
  const createdTimestamp = Date.parse(event.createdAt);
  return {
    id: `${type}:${event.id}`,
    quoteId: quote.id,
    quoteCode: quote.code,
    customerName: quote.customerName || "Cliente",
    type,
    createdAt: event.createdAt,
    description,
    isRead: Number.isFinite(seenTimestamp) && createdTimestamp <= seenTimestamp,
    shouldPlaySound
  };
}

function readSeenAt(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const seenAt = (value as Record<string, unknown>).seen_at;
  return typeof seenAt === "string" ? seenAt : undefined;
}

function mapEvent(row: Record<string, unknown>): QuoteEvent {
  return {
    id: String(row.id),
    quoteId: String(row.quote_id),
    eventType: String(row.event_type) as QuoteEvent["eventType"],
    createdAt: String(row.created_at),
    userAgent: row.user_agent ? String(row.user_agent) : undefined,
    metadata: row.metadata && typeof row.metadata === "object" ? row.metadata as Record<string, unknown> : {}
  };
}
