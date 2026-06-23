import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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

    await supabase.from("email_logs").insert({
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

  const { data: existing } = await supabase
    .from("email_logs")
    .select("id, status, raw_events, delivered_at, opened_at, clicked_at, bounced_at")
    .in("brevo_message_id", variants)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

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

  await supabase.from("email_logs").update(updates).eq("id", existing.id);
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
