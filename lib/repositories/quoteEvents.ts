import { allDemoQuotes, allQuoteEvents, allQuoteStatusEvents, recordQuoteEvent } from "@/lib/demo-store";
import { updateQuoteStatus } from "@/lib/repositories/quotes";
import { createQuoteStatusEvent } from "@/lib/repositories/quoteStatusEvents";
import { fallback, fromSupabase, RepositoryResult } from "@/lib/repositories/shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getTrackingExcludedIps, isExcludedTrackingEvent } from "@/lib/server/trackingFilters";
import { QuoteEvent } from "@/lib/types";

export async function trackQuoteEvent(quoteId: string, eventType: QuoteEvent["eventType"], metadata: Record<string, unknown> = {}, userAgent?: string): Promise<RepositoryResult<QuoteEvent | null>> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    const event = recordQuoteEvent(quoteId, eventType, metadata, userAgent);
    if (eventType === "quote_opened") await recordOpenedStatusEvent(quoteId);
    return fallback(event);
  }

  if (eventType === "quote_opened" && typeof metadata.visitor_id === "string") {
    const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: recentOpening } = await supabase
      .from("quote_events")
      .select("*")
      .eq("quote_id", quoteId)
      .eq("event_type", "quote_opened")
      .eq("metadata->>visitor_id", metadata.visitor_id)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recentOpening) return fromSupabase(mapEvent(recentOpening));
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
  const local = trackableEvents(allQuoteEvents().filter((event) => event.quoteId === quoteId));
  const supabase = createSupabaseAdminClient();
  if (!supabase) return fallback(local);

  const { data, error } = await supabase.from("quote_events").select("*").eq("quote_id", quoteId).order("created_at");
  if (error) return fallback(local, error);
  return fromSupabase(deduplicateEvents(trackableEvents((data ?? []).map(mapEvent))));
}

export async function getQuoteEventsForQuoteIds(quoteIds: string[]): Promise<RepositoryResult<Record<string, QuoteEvent[]>>> {
  const local = groupEventsByQuote(trackableEvents(allQuoteEvents().filter((event) => quoteIds.includes(event.quoteId))));
  if (!quoteIds.length) return fromSupabase({});

  const supabase = createSupabaseAdminClient();
  if (!supabase) return fallback(local);

  const pageSize = 1000;
  const rows: Record<string, any>[] = [];
  // PostgREST serializza `.in()` nella query string. Con centinaia di
  // preventivi un'unica richiesta supera il limite URL e risponde 400.
  for (const quoteIdsChunk of chunkArray(quoteIds, 100)) {
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase
        .from("quote_events")
        .select("*")
        .in("quote_id", quoteIdsChunk)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) return fallback(local, error);
      rows.push(...(data ?? []));
      if ((data ?? []).length < pageSize) break;
    }
  }
  return fromSupabase(groupEventsByQuote(deduplicateEvents(trackableEvents(rows.map(mapEvent)))));
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
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
  const localEvents = trackableEvents(allQuoteEvents());
  if (!supabase) return fallback(eventDashboard(localEvents));

  const [aggregateResult, followUpResult, openingResult] = await Promise.all([
    supabase.rpc("get_dashboard_event_stats", {
      p_excluded_ips: getTrackingExcludedIps()
    }).maybeSingle(),
    supabase
      .from("quote_events")
      .select("*")
      .eq("event_type", "follow_up_whatsapp_click")
      .order("created_at", { ascending: true }),
    (async () => {
      const rows: Record<string, unknown>[] = [];
      const pageSize = 1000;
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase
          .from("quote_events")
          .select("quote_id,created_at,user_agent,metadata")
          .eq("event_type", "quote_opened")
          .order("created_at", { ascending: true })
          .range(from, from + pageSize - 1);
        if (error) return { data: rows, error };
        rows.push(...(data ?? []));
        if ((data ?? []).length < pageSize) return { data: rows, error: null };
      }
    })()
  ]);
  if (aggregateResult.error || followUpResult.error || openingResult.error) {
    return fallback(eventDashboard(localEvents), aggregateResult.error ?? followUpResult.error ?? openingResult.error);
  }
  const openingEvents = deduplicateEvents(trackableEvents((openingResult.data ?? []).map((row, index) => mapEvent({
    id: `dashboard-opening-${index}`,
    event_type: "quote_opened",
    ...row
  }))));
  return fromSupabase({
    ...mapDashboardEventAggregates(aggregateResult.data),
    openingCountByQuote: countOpeningsByQuote(openingEvents),
    ...followUpDashboard((followUpResult.data ?? []).map(mapEvent))
  });
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
  const openingEvents = events.filter((event) => event.eventType === "quote_opened");
  return {
    openedQuoteIds: new Set(openingEvents.map((event) => event.quoteId)),
    openingCountByQuote: countOpeningsByQuote(openingEvents),
    whatsappClickQuoteIds: events.filter((event) => event.eventType === "whatsapp_clicked" && isCustomerWhatsappEvent(event)).map((event) => event.quoteId),
    confirmedEventIds: new Set(events.filter((event) => event.eventType === "quote_confirmed").map((event) => event.quoteId)),
    ...followUpDashboard(events.filter((event) => event.eventType === "follow_up_whatsapp_click"))
  };
}

function countOpeningsByQuote(events: QuoteEvent[]) {
  return events.reduce<Record<string, number>>((counts, event) => {
    counts[event.quoteId] = (counts[event.quoteId] ?? 0) + 1;
    return counts;
  }, {});
}

function followUpDashboard(events: QuoteEvent[]) {
  const contactedQuoteIds = new Set<string>();
  const closedFollowUpQuoteIds = new Set<string>();
  const snoozedUntilByQuote: Record<string, string> = {};
  const lastContactAtByQuote: Record<string, string> = {};

  for (const event of events) {
    const action = String(event.metadata?.action ?? "");
    if (["whatsapp", "email", "called", "solicited"].includes(action)) {
      contactedQuoteIds.add(event.quoteId);
      lastContactAtByQuote[event.quoteId] = event.createdAt;
    }
    if (action === "closed") closedFollowUpQuoteIds.add(event.quoteId);
    if (action === "snoozed" && typeof event.metadata?.snoozed_until === "string") {
      snoozedUntilByQuote[event.quoteId] = event.metadata.snoozed_until;
    }
  }

  return { contactedQuoteIds, closedFollowUpQuoteIds, snoozedUntilByQuote, lastContactAtByQuote };
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

export function trackableEvents(events: QuoteEvent[]) {
  return events.filter((event) => !isExcludedTrackingEvent(event));
}

function deduplicateEvents(events: QuoteEvent[]) {
  const seenIds = new Set<string>();
  const seenSignatures = new Set<string>();
  const lastOpeningByVisitor = new Map<string, number>();
  const latestLegacyOpeningId = new Map<string, string>();
  for (const event of events) {
    if (event.eventType === "quote_opened" && typeof event.metadata?.visitor_id !== "string") {
      latestLegacyOpeningId.set(event.quoteId, event.id);
    }
  }
  return events.filter((event) => {
    const signature = JSON.stringify([event.quoteId, event.eventType, event.createdAt, event.userAgent ?? "", event.metadata ?? {}]);
    if (seenIds.has(event.id) || seenSignatures.has(signature)) return false;
    seenIds.add(event.id);
    seenSignatures.add(signature);

    if (event.eventType === "quote_opened") {
      const visitorId = typeof event.metadata?.visitor_id === "string" ? event.metadata.visitor_id : "";
      if (!visitorId) {
        return latestLegacyOpeningId.get(event.quoteId) === event.id;
      }

      const visitorKey = `${event.quoteId}:${visitorId}`;
      const timestamp = new Date(event.createdAt).getTime();
      const previous = lastOpeningByVisitor.get(visitorKey);
      if (previous !== undefined && timestamp - previous < 30 * 60 * 1000) return false;
      lastOpeningByVisitor.set(visitorKey, timestamp);
    }
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
