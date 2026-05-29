import { allDemoQuotes, allQuoteEvents, allQuoteStatusEvents, recordQuoteEvent } from "@/lib/demo-store";
import { createQuoteStatusEvent } from "@/lib/repositories/quoteStatusEvents";
import { fallback, fromSupabase, RepositoryResult } from "@/lib/repositories/shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { QuoteEvent } from "@/lib/types";

export async function trackQuoteEvent(quoteId: string, eventType: QuoteEvent["eventType"], metadata: Record<string, unknown> = {}, userAgent?: string): Promise<RepositoryResult<QuoteEvent | null>> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    const event = recordQuoteEvent(quoteId, eventType, metadata, userAgent);
    if (eventType === "quote_opened") await recordOpenedStatusEvent(quoteId);
    return fallback(event);
  }

  const { data, error } = await supabase
    .from("quote_events")
    .insert({ quote_id: quoteId, event_type: eventType, metadata, user_agent: userAgent })
    .select("*")
    .single();

  if (error) return fallback(recordQuoteEvent(quoteId, eventType, metadata, userAgent), error);
  if (eventType === "quote_opened") await markQuoteOpenedInSupabase(quoteId);
  return fromSupabase(mapEvent(data));
}

async function recordOpenedStatusEvent(quoteId: string) {
  const quote = allDemoQuotes().find((item) => item.id === quoteId);
  if (!quote || quote.status !== "preventivo_inviato") return;
  if (allQuoteStatusEvents().some((event) => event.quoteId === quoteId && event.toStatus === "aperto")) return;

  await createQuoteStatusEvent({
    quoteId,
    fromStatus: "preventivo_inviato",
    toStatus: "aperto",
    note: "Preventivo aperto dal cliente"
  });
}

async function markQuoteOpenedInSupabase(quoteId: string) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return;

  const { data } = await supabase.from("quotes").select("status").eq("id", quoteId).maybeSingle();
  if (data?.status !== "preventivo_inviato") return;

  const { error } = await supabase.from("quotes").update({ status: "aperto", updated_at: new Date().toISOString() }).eq("id", quoteId);
  if (error) return;

  await createQuoteStatusEvent({
    quoteId,
    fromStatus: "preventivo_inviato",
    toStatus: "aperto",
    note: "Preventivo aperto dal cliente"
  });
}

export async function getQuoteEvents(quoteId: string): Promise<RepositoryResult<QuoteEvent[]>> {
  const local = allQuoteEvents().filter((event) => event.quoteId === quoteId);
  const supabase = createSupabaseAdminClient();
  if (!supabase) return fallback(local);

  const { data, error } = await supabase.from("quote_events").select("*").eq("quote_id", quoteId).order("created_at");
  if (error) return fallback(local, error);
  return fromSupabase((data ?? []).map(mapEvent));
}

export async function getQuoteEventStats(quoteId: string) {
  const result = await getQuoteEvents(quoteId);
  const events = result.data;
  const openings = events.filter((event) => event.eventType === "quote_opened");
  return {
    data: {
      openings: openings.length,
      lastOpening: openings.at(-1)?.createdAt,
      whatsappClicks: events.filter((event) => event.eventType === "whatsapp_clicked").length,
      confirmClicked: events.some((event) => event.eventType === "confirm_clicked"),
      confirmed: events.some((event) => event.eventType === "quote_confirmed")
    },
    source: result.source,
    error: result.error
  };
}

export async function getDashboardEventStats() {
  const supabase = createSupabaseAdminClient();
  const localEvents = allQuoteEvents();
  if (!supabase) return fallback(eventDashboard(localEvents));

  const { data, error } = await supabase.from("quote_events").select("*");
  if (error) return fallback(eventDashboard(localEvents), error);
  return fromSupabase(eventDashboard((data ?? []).map(mapEvent)));
}

function eventDashboard(events: QuoteEvent[]) {
  return {
    openedQuoteIds: new Set(events.filter((event) => event.eventType === "quote_opened").map((event) => event.quoteId)),
    whatsappClickQuoteIds: events.filter((event) => event.eventType === "whatsapp_clicked").map((event) => event.quoteId),
    confirmedEventIds: new Set(events.filter((event) => event.eventType === "quote_confirmed").map((event) => event.quoteId)),
    lastOpened: events.filter((event) => event.eventType === "quote_opened").at(-1)
  };
}

function mapEvent(row: Record<string, any>): QuoteEvent {
  return {
    id: row.id,
    quoteId: row.quote_id,
    eventType: row.event_type,
    createdAt: row.created_at,
    userAgent: row.user_agent ?? undefined,
    metadata: row.metadata ?? {}
  };
}
