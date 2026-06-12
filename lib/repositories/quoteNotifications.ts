import "server-only";

import { allDemoQuotes, allQuoteEvents } from "@/lib/demo-store";
import { fallback, fromSupabase, RepositoryResult } from "@/lib/repositories/shared";
import { isExcludedTrackingEvent } from "@/lib/server/trackingFilters";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { QuoteEvent } from "@/lib/types";

export const QUOTE_NOTIFICATIONS_SEEN_KEY = "quote_notifications_seen_at";

export type QuoteNotificationType = "apertura" | "cliente_caldo" | "conferma";

export type QuoteNotification = {
  id: string;
  quoteId: string;
  quoteCode: string;
  customerName: string;
  type: QuoteNotificationType;
  createdAt: string;
  description: string;
  isRead: boolean;
};

type QuoteNotificationSource = {
  id: string;
  code: string;
  customerName: string;
};

export function deriveQuoteNotifications(
  events: QuoteEvent[],
  quotes: QuoteNotificationSource[],
  seenAt?: string
): QuoteNotification[] {
  const quoteById = new Map(quotes.map((quote) => [quote.id, quote]));
  const seenTimestamp = seenAt ? Date.parse(seenAt) : Number.NaN;
  const grouped = events
    .filter((event) => !isExcludedTrackingEvent(event))
    .filter((event) => event.eventType === "quote_opened" || event.eventType === "quote_confirmed")
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    .reduce<Record<string, QuoteEvent[]>>((result, event) => {
      result[event.quoteId] = [...(result[event.quoteId] ?? []), event];
      return result;
    }, {});

  const notifications: QuoteNotification[] = [];

  for (const [quoteId, quoteEvents] of Object.entries(grouped)) {
    const quote = quoteById.get(quoteId);
    if (!quote) continue;

    const openings = quoteEvents.filter((event) => event.eventType === "quote_opened");
    const firstOpening = openings[0];
    const hotOpening = openings[2];
    const confirmation = quoteEvents.find((event) => event.eventType === "quote_confirmed");

    if (firstOpening) {
      notifications.push(buildNotification(firstOpening, quote, "apertura", "ha aperto il preventivo", seenTimestamp));
    }
    if (hotOpening) {
      notifications.push(buildNotification(hotOpening, quote, "cliente_caldo", "sta guardando di nuovo — cliente caldo", seenTimestamp));
    }
    if (confirmation) {
      const selectedHotel = typeof confirmation.metadata?.selectedHotelName === "string"
        ? confirmation.metadata.selectedHotelName.trim()
        : "";
      notifications.push(buildNotification(
        confirmation,
        quote,
        "conferma",
        selectedHotel ? `ha confermato ${selectedHotel}` : "ha confermato una proposta",
        seenTimestamp
      ));
    }
  }

  return notifications.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export async function getQuoteNotifications(limit = 20): Promise<RepositoryResult<QuoteNotification[]>> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    const quotes = allDemoQuotes().map((quote) => ({
      id: quote.id,
      code: quote.code,
      customerName: `${quote.customerFirstName} ${quote.customerLastName}`.trim()
    }));
    return fallback(deriveQuoteNotifications(allQuoteEvents(), quotes).slice(0, limit));
  }

  const [{ data: eventRows, error: eventError }, { data: quoteRows, error: quoteError }, { data: settingRow, error: settingError }] = await Promise.all([
    supabase.from("quote_events").select("*").in("event_type", ["quote_opened", "quote_confirmed"]).order("created_at"),
    supabase.from("quotes").select("id,code,client_first_name,client_last_name"),
    supabase.from("settings").select("value").eq("key", QUOTE_NOTIFICATIONS_SEEN_KEY).maybeSingle()
  ]);

  const error = eventError ?? quoteError ?? settingError;
  if (error) return fallback([], error);

  const events = (eventRows ?? []).map(mapEvent);
  const quotes = (quoteRows ?? []).map((row) => ({
    id: String(row.id),
    code: String(row.code),
    customerName: `${String(row.client_first_name ?? "")} ${String(row.client_last_name ?? "")}`.trim()
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

function buildNotification(
  event: QuoteEvent,
  quote: QuoteNotificationSource,
  type: QuoteNotificationType,
  description: string,
  seenTimestamp: number
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
    isRead: Number.isFinite(seenTimestamp) && createdTimestamp <= seenTimestamp
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
