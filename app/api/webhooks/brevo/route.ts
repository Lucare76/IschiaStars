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

  const updated = await updateEmailLogFromBrevoEvent(body);
  return NextResponse.json({ ok: true, matched: updated });
}
