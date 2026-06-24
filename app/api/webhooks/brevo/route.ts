import { NextRequest, NextResponse } from "next/server";
import { updateEmailLogFromBrevoEvent, type BrevoWebhookEvent } from "@/lib/repositories/emailLogs";

const SENSITIVE_KEYS = ["email", "recipient", "to", "token", "secret", "subject"];

function safeKeys(obj: Record<string, unknown>): string[] {
  return Object.keys(obj).filter(
    (k) => !SENSITIVE_KEYS.includes(k.toLowerCase())
  );
}

function debugLogEvent(event: BrevoWebhookEvent, matched: boolean): void {
  const keys = safeKeys(event as Record<string, unknown>);
  const messageIdFields: Record<string, unknown> = {};
  for (const k of Object.keys(event)) {
    if (/message|msg.*id/i.test(k)) {
      messageIdFields[k] = event[k];
    }
  }
  console.log(
    `[brevo-webhook-debug] event=${event.event} keys=${keys.join(",")} messageIdFields=${JSON.stringify(messageIdFields)} matched=${matched}`
  );
}

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
    const topKeys = body && typeof body === "object" ? safeKeys(body as Record<string, unknown>) : [];
    console.log(`[brevo-webhook-debug] ignored payload keys=${topKeys.join(",")}`);
    return NextResponse.json({ ok: true, matched: false, ignored: true, reason: "no_events" });
  }

  let matched = 0;
  for (const event of events) {
    const updated = await updateEmailLogFromBrevoEvent(event);
    debugLogEvent(event, updated);
    if (updated) matched++;
  }

  return NextResponse.json({ ok: true, received: events.length, matched });
}
