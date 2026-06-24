import { NextRequest, NextResponse } from "next/server";
import { getEmailLogQuoteIdByMessageId, updateEmailLogFromBrevoEvent, type BrevoWebhookEvent } from "@/lib/repositories/emailLogs";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function extractBrevoWebhookEvents(body: unknown): BrevoWebhookEvent[] {
  if (Array.isArray(body)) {
    return body.filter((item) => item && typeof item === "object" && typeof item.event === "string");
  }

  if (body && typeof body === "object") {
    const obj = body as Record<string, unknown>;

    if (typeof obj.event === "string") {
      return [obj as unknown as BrevoWebhookEvent];
    }

    for (const wrapper of ["events", "items", "data", "payload"] as const) {
      const inner = obj[wrapper];
      if (Array.isArray(inner)) {
        return inner.filter((item) => item && typeof item === "object" && typeof item.event === "string");
      }
      if (inner && typeof inner === "object" && typeof (inner as Record<string, unknown>).event === "string") {
        return [inner as unknown as BrevoWebhookEvent];
      }
    }
  }

  return [];
}

export async function POST(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");
  const expectedSecret = process.env.BREVO_WEBHOOK_SECRET;

  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const events = extractBrevoWebhookEvents(body);

  if (events.length === 0) {
    console.warn("[brevo-webhook] payload ignorato: nessun evento riconosciuto");
    return NextResponse.json({ ok: true, matched: false, ignored: true, reason: "no_events" });
  }

  let matched = 0;
  for (const event of events) {
    const updated = await updateEmailLogFromBrevoEvent(event);
    if (updated) {
      matched++;
      if (event.event?.toLowerCase() === "click") {
        await maybeCreateEmailLinkClickedEvent(event);
      }
    }
  }

  return NextResponse.json({ ok: true, received: events.length, matched });
}

async function maybeCreateEmailLinkClickedEvent(event: BrevoWebhookEvent) {
  try {
    const rawMessageId = event["message-id"] ?? event.messageId ?? event.message_id ?? event.MessageId ?? event["Message-Id"];
    if (!rawMessageId || typeof rawMessageId !== "string") return;

    const emailInfo = await getEmailLogQuoteIdByMessageId(rawMessageId);
    if (!emailInfo || emailInfo.emailType !== "quote_to_client") return;

    const supabase = createSupabaseAdminClient();
    if (!supabase) return;

    const { data: existing } = await supabase
      .from("quote_events")
      .select("id")
      .eq("quote_id", emailInfo.quoteId)
      .eq("event_type", "email_link_clicked")
      .limit(1)
      .maybeSingle();

    if (existing) return;

    await supabase.from("quote_events").insert({
      quote_id: emailInfo.quoteId,
      event_type: "email_link_clicked",
      metadata: { source: "brevo_webhook" }
    });
  } catch (err) {
    console.error("[brevo-webhook] email_link_clicked event creation failed", err instanceof Error ? err.message : err);
  }
}
