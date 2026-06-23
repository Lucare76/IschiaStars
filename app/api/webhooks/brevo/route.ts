import { NextRequest, NextResponse } from "next/server";
import { updateEmailLogFromBrevoEvent, type BrevoWebhookEvent } from "@/lib/repositories/emailLogs";

export async function POST(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");
  const expectedSecret = process.env.BREVO_WEBHOOK_SECRET;

  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: BrevoWebhookEvent;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.event) {
    return NextResponse.json({ error: "Missing event" }, { status: 400 });
  }

  // --- DEBUG TEMPORANEO: rimuovere dopo aver identificato il formato ---
  const safeKeys = Object.keys(body).filter(
    (k) => !["email", "recipient", "to", "token", "secret", "subject"].includes(k.toLowerCase())
  );
  const messageIdFields: Record<string, unknown> = {};
  for (const k of Object.keys(body)) {
    if (/message|msg.*id/i.test(k)) {
      messageIdFields[k] = body[k as keyof typeof body];
    }
  }
  console.log(
    `[brevo-webhook-debug] event=${body.event} keys=${safeKeys.join(",")} messageIdFields=${JSON.stringify(messageIdFields)}`
  );
  // --- FINE DEBUG TEMPORANEO ---

  const updated = await updateEmailLogFromBrevoEvent(body);

  console.log(`[brevo-webhook-debug] matched=${updated}`);

  return NextResponse.json({ ok: true, matched: updated });
}
