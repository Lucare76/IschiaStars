import { allDemoQuotes, allQuoteEvents, allQuoteStatusEvents, recordQuoteEvent } from "@/lib/demo-store";
import { updateQuoteStatus } from "@/lib/repositories/quotes";
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
  if (data?.status === "in_lavorazione") {
    await updateQuoteStatus(quoteId, "preventivo_inviato");
  }
  if (data?.status !== "preventivo_inviato" && data?.status !== "in_lavorazione") return;

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

export async function getQuoteEventsForQuoteIds(quoteIds: string[]): Promise<RepositoryResult<Record<string, QuoteEvent[]>>> {
  const local = groupEventsByQuote(allQuoteEvents().filter((event) => quoteIds.includes(event.quoteId)));
  if (!quoteIds.length) return fromSupabase({});

  const supabase = createSupabaseAdminClient();
  if (!supabase) return fallback(local);

  const pageSize = 1000;
  const rows: Record<string, any>[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("quote_events")
      .select("*")
      .in("quote_id", quoteIds)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) return fallback(local, error);
    rows.push(...(data ?? []));
    if ((data ?? []).length < pageSize) break;
  }
  return fromSupabase(groupEventsByQuote(deduplicateEvents(rows.map(mapEvent))));
}

export async function getQuoteEventStats(quoteId: string) {
  const result = await getQuoteEvents(quoteId);
  const events = result.data;
  const openings = events.filter((event) => event.eventType === "quote_opened");
  return {
    data: {
      openings: openings.length,
      lastOpening: openings.at(-1)?.createdAt,
      whatsappClicks: events.filter((event) => event.eventType === "whatsapp_clicked" && isCustomerWhatsappEvent(event)).length,
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

  const { data, error } = await supabase.rpc("get_dashboard_event_stats").maybeSingle();
  if (error) return fallback(eventDashboard(localEvents), error);
  return fromSupabase(mapDashboardEventAggregates(data));
}

function mapDashboardEventAggregates(row: unknown) {
  const aggregates = (row ?? {}) as Record<string, string[] | null | undefined>;
  return {
    openedQuoteIds: new Set<string>(aggregates.opened_quote_ids ?? []),
    confirmedEventIds: new Set<string>(aggregates.confirmed_quote_ids ?? []),
    whatsappClickQuoteIds: aggregates.whatsapp_click_quote_ids ?? []
  };
}

function eventDashboard(events: QuoteEvent[]) {
  return {
    openedQuoteIds: new Set(events.filter((event) => event.eventType === "quote_opened").map((event) => event.quoteId)),
    whatsappClickQuoteIds: events.filter((event) => event.eventType === "whatsapp_clicked" && isCustomerWhatsappEvent(event)).map((event) => event.quoteId),
    confirmedEventIds: new Set(events.filter((event) => event.eventType === "quote_confirmed").map((event) => event.quoteId))
  };
}

function isCustomerWhatsappEvent(event: QuoteEvent) {
  const placement = typeof event.metadata?.placement === "string" ? event.metadata.placement : "";
  return placement !== "admin_quote_card";
}

function groupEventsByQuote(events: QuoteEvent[]) {
  return events.reduce<Record<string, QuoteEvent[]>>((grouped, event) => {
    grouped[event.quoteId] = [...(grouped[event.quoteId] ?? []), event];
    return grouped;
  }, {});
}

function deduplicateEvents(events: QuoteEvent[]) {
  const seenIds = new Set<string>();
  const seenSignatures = new Set<string>();
  return events.filter((event) => {
    const signature = JSON.stringify([event.quoteId, event.eventType, event.createdAt, event.userAgent ?? "", event.metadata ?? {}]);
    if (seenIds.has(event.id) || seenSignatures.has(signature)) return false;
    seenIds.add(event.id);
    seenSignatures.add(signature);
    return true;
  });
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
