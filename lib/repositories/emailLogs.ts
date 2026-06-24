import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fallback, fromSupabase, type RepositoryResult } from "@/lib/repositories/shared";

export type EmailType =
  | "quote_to_client"
  | "confirmation_internal"
  | "final_confirmation_to_client"
  | "voucher_to_client"
  | "supplier_confirmation"
  | "unavailability_to_client";

export type EmailLogStatus =
  | "sent"
  | "failed"
  | "delivered"
  | "opened"
  | "clicked"
  | "soft_bounce"
  | "hard_bounce"
  | "blocked"
  | "error"
  | "deferred";

export type EmailLog = {
  id: string;
  quoteId: string | null;
  confirmationId: string | null;
  emailType: EmailType;
  recipientEmail: string;
  brevoMessageId: string | null;
  subject: string | null;
  status: EmailLogStatus;
  sentAt: string | null;
  deliveredAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  bouncedAt: string | null;
  lastEventAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type QuoteEmailDashboardStatus = {
  sent: boolean;
  delivered: boolean;
  opened: boolean;
  clicked: boolean;
  problem: boolean;
  sentCount: number;
  deliveredCount: number;
  openedCount: number;
  clickedCount: number;
  problemCount: number;
  lastActivityAt: string | null;
};

export type QuoteEmailDashboardData = {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  problems: number;
  byQuoteId: Record<string, QuoteEmailDashboardStatus>;
};

export type LogEmailAttemptParams = {
  quoteId?: string;
  confirmationId?: string;
  emailType: EmailType;
  recipientEmail: string;
  subject: string;
  brevoMessageId?: string;
  ok: boolean;
  errorMessage?: string;
};

export async function logEmailAttempt(params: LogEmailAttemptParams): Promise<void> {
  try {
    const supabase = createSupabaseAdminClient();
    if (!supabase) return;

    const { error } = await supabase.from("email_logs").insert({
      quote_id: params.quoteId ?? null,
      confirmation_id: params.confirmationId ?? null,
      email_type: params.emailType,
      recipient_email: params.recipientEmail,
      subject: params.subject,
      brevo_message_id: normalizeBrevoMessageId(params.brevoMessageId),
      status: params.ok ? "sent" : "failed",
      sent_at: params.ok ? new Date().toISOString() : null,
      error_message: params.errorMessage ?? null,
    });
    if (error) {
      console.error("[email-logs] failed to log email attempt", error.message);
    }
  } catch (err) {
    console.error("[email-logs] failed to log email attempt", err instanceof Error ? err.message : err);
  }
}

export type BrevoWebhookEvent = {
  event: string;
  messageId?: string;
  "message-id"?: string;
  message_id?: string;
  MessageId?: string;
  "Message-Id"?: string;
  ts_event?: number;
  date?: string;
  reason?: string;
  [key: string]: unknown;
};

function normalizeBrevoMessageId(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.replace(/^<|>$/g, "");
}

const STATUS_PRIORITY: Record<string, number> = {
  failed: 0,
  sent: 1,
  deferred: 2,
  delivered: 3,
  opened: 4,
  clicked: 5,
  soft_bounce: 1,
  hard_bounce: 1,
  blocked: 1,
  error: 1,
};

export async function updateEmailLogFromBrevoEvent(event: BrevoWebhookEvent): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return false;

  const rawMessageId = event["message-id"] ?? event.messageId ?? event.message_id ?? event.MessageId ?? event["Message-Id"];
  if (!rawMessageId || typeof rawMessageId !== "string") return false;

  const normalized = normalizeBrevoMessageId(rawMessageId);
  if (!normalized) return false;

  const variants = Array.from(new Set([normalized, `<${normalized}>`, rawMessageId.trim()]));

  const { data: existing, error: lookupError } = await supabase
    .from("email_logs")
    .select("id, status, raw_events, delivered_at, opened_at, clicked_at, bounced_at")
    .in("brevo_message_id", variants)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lookupError) {
    console.error("[email-logs] webhook lookup failed", lookupError.message);
    return false;
  }

  if (!existing) {
    console.warn(`[email-logs] webhook event for unknown message_id=${normalized} event=${event.event}`);
    return false;
  }

  const eventTs = event.ts_event ? new Date(event.ts_event * 1000).toISOString() : new Date().toISOString();
  const brevoEvent = event.event?.toLowerCase();

  const updates: Record<string, unknown> = {
    last_event_at: eventTs,
    updated_at: new Date().toISOString(),
  };

  let newStatus: EmailLogStatus | null = null;

  switch (brevoEvent) {
    case "delivered":
      newStatus = "delivered";
      if (!existing.delivered_at) updates.delivered_at = eventTs;
      break;
    case "opened":
    case "unique_opened":
      newStatus = "opened";
      if (!existing.opened_at) updates.opened_at = eventTs;
      break;
    case "click":
      newStatus = "clicked";
      if (!existing.clicked_at) updates.clicked_at = eventTs;
      break;
    case "soft_bounce":
      newStatus = "soft_bounce";
      if (!existing.bounced_at) updates.bounced_at = eventTs;
      if (event.reason) updates.error_message = event.reason;
      break;
    case "hard_bounce":
      newStatus = "hard_bounce";
      if (!existing.bounced_at) updates.bounced_at = eventTs;
      if (event.reason) updates.error_message = event.reason;
      break;
    case "blocked":
      newStatus = "blocked";
      if (!existing.bounced_at) updates.bounced_at = eventTs;
      if (event.reason) updates.error_message = event.reason;
      break;
    case "error":
      newStatus = "error";
      if (event.reason) updates.error_message = event.reason;
      break;
    case "deferred":
      newStatus = "deferred";
      break;
    default:
      break;
  }

  if (newStatus) {
    const currentPriority = STATUS_PRIORITY[existing.status] ?? 0;
    const newPriority = STATUS_PRIORITY[newStatus] ?? 0;
    if (newPriority >= currentPriority) {
      updates.status = newStatus;
    }
  }

  const rawEvents = Array.isArray(existing.raw_events) ? existing.raw_events : [];
  if (rawEvents.length < 50) {
    updates.raw_events = [...rawEvents, { event: brevoEvent, ts: eventTs, reason: event.reason }];
  }

  const { error: updateError } = await supabase.from("email_logs").update(updates).eq("id", existing.id);
  if (updateError) {
    console.error("[email-logs] webhook update failed", updateError.message);
    return false;
  }
  return true;
}

function mapEmailLogRow(row: Record<string, unknown>): EmailLog {
  return {
    id: String(row.id),
    quoteId: row.quote_id ? String(row.quote_id) : null,
    confirmationId: row.confirmation_id ? String(row.confirmation_id) : null,
    emailType: String(row.email_type) as EmailType,
    recipientEmail: String(row.recipient_email),
    brevoMessageId: row.brevo_message_id ? String(row.brevo_message_id) : null,
    subject: row.subject ? String(row.subject) : null,
    status: String(row.status) as EmailLogStatus,
    sentAt: row.sent_at ? String(row.sent_at) : null,
    deliveredAt: row.delivered_at ? String(row.delivered_at) : null,
    openedAt: row.opened_at ? String(row.opened_at) : null,
    clickedAt: row.clicked_at ? String(row.clicked_at) : null,
    bouncedAt: row.bounced_at ? String(row.bounced_at) : null,
    lastEventAt: row.last_event_at ? String(row.last_event_at) : null,
    errorMessage: row.error_message ? String(row.error_message) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function getEmailLogsForQuote(quoteId: string): Promise<EmailLog[]> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from("email_logs")
    .select("*")
    .eq("quote_id", quoteId)
    .order("created_at", { ascending: true });

  return (data ?? []).map(mapEmailLogRow);
}

export async function getEmailLogsForQuoteIds(quoteIds: string[]): Promise<Record<string, EmailLog[]>> {
  if (!quoteIds.length) return {};
  const supabase = createSupabaseAdminClient();
  if (!supabase) return {};

  const result: Record<string, EmailLog[]> = {};
  for (let i = 0; i < quoteIds.length; i += 100) {
    const chunk = quoteIds.slice(i, i + 100);
    const { data } = await supabase
      .from("email_logs")
      .select("*")
      .in("quote_id", chunk)
      .order("created_at", { ascending: true });

    for (const row of data ?? []) {
      const qid = String(row.quote_id);
      if (!result[qid]) result[qid] = [];
      result[qid].push(mapEmailLogRow(row));
    }
  }
  return result;
}

export async function getQuoteEmailDashboardData(): Promise<RepositoryResult<QuoteEmailDashboardData>> {
  const empty = emptyQuoteEmailDashboardData();
  const supabase = createSupabaseAdminClient();
  if (!supabase) return fallback(empty);

  const rows: Record<string, unknown>[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("email_logs")
      .select("quote_id,status,sent_at,delivered_at,opened_at,clicked_at,bounced_at,last_event_at,created_at")
      .eq("email_type", "quote_to_client")
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) return fallback(empty, error);
    rows.push(...(data ?? []));
    if ((data ?? []).length < pageSize) break;
  }

  const byQuoteId: Record<string, QuoteEmailDashboardStatus> = {};
  for (const row of rows) {
    if (!row.quote_id) continue;
    const quoteId = String(row.quote_id);
    const current = byQuoteId[quoteId] ?? emptyQuoteEmailStatus();
    const status = String(row.status ?? "");
    const lastActivityAt = latestIso(
      current.lastActivityAt,
      row.last_event_at,
      row.clicked_at,
      row.opened_at,
      row.delivered_at,
      row.sent_at,
      row.created_at
    );
    byQuoteId[quoteId] = {
      sent: current.sent || Boolean(row.sent_at),
      delivered: current.delivered || Boolean(row.delivered_at),
      opened: current.opened || Boolean(row.opened_at),
      clicked: current.clicked || Boolean(row.clicked_at),
      problem: current.problem || isDeliveryProblem(status),
      sentCount: current.sentCount + (row.sent_at ? 1 : 0),
      deliveredCount: current.deliveredCount + (row.delivered_at ? 1 : 0),
      openedCount: current.openedCount + (row.opened_at ? 1 : 0),
      clickedCount: current.clickedCount + (row.clicked_at ? 1 : 0),
      problemCount: current.problemCount + (isDeliveryProblem(status) ? 1 : 0),
      lastActivityAt
    };
  }

  return fromSupabase({
    sent: rows.filter((row) => Boolean(row.sent_at)).length,
    delivered: rows.filter((row) => Boolean(row.delivered_at)).length,
    opened: rows.filter((row) => Boolean(row.opened_at)).length,
    clicked: rows.filter((row) => Boolean(row.clicked_at)).length,
    problems: rows.filter((row) => isDeliveryProblem(String(row.status ?? ""))).length,
    byQuoteId
  });
}

function emptyQuoteEmailDashboardData(): QuoteEmailDashboardData {
  return {
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    problems: 0,
    byQuoteId: {}
  };
}

function emptyQuoteEmailStatus(): QuoteEmailDashboardStatus {
  return {
    sent: false,
    delivered: false,
    opened: false,
    clicked: false,
    problem: false,
    sentCount: 0,
    deliveredCount: 0,
    openedCount: 0,
    clickedCount: 0,
    problemCount: 0,
    lastActivityAt: null
  };
}

function isDeliveryProblem(status: string) {
  return ["failed", "soft_bounce", "hard_bounce", "blocked", "error", "invalid"].includes(status);
}

function latestIso(...values: unknown[]): string | null {
  return values
    .filter((value): value is string => typeof value === "string" && Boolean(value))
    .sort()
    .at(-1) ?? null;
}
