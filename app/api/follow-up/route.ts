import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/server/auth-guard";
import { trackQuoteEvent } from "@/lib/repositories/quoteEvents";

const actions = ["called", "solicited", "snoozed", "closed"] as const;
type FollowUpAction = (typeof actions)[number];

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminApiAccess(request);
  if (unauthorized) return unauthorized;

  const body = (await request.json().catch(() => null)) as {
    quoteId?: string;
    action?: FollowUpAction;
    snoozedUntil?: string;
  } | null;

  if (!body?.quoteId || !body.action || !actions.includes(body.action)) {
    return NextResponse.json({ ok: false, error: "Azione follow-up non valida" }, { status: 400 });
  }

  const metadata: Record<string, unknown> = {
    action: body.action,
    source: "admin_follow_up"
  };

  if (body.action === "snoozed") {
    if (!body.snoozedUntil || Number.isNaN(new Date(body.snoozedUntil).getTime())) {
      return NextResponse.json({ ok: false, error: "Data promemoria non valida" }, { status: 400 });
    }
    metadata.snoozed_until = body.snoozedUntil;
  }

  const result = await trackQuoteEvent(body.quoteId, "follow_up_whatsapp_click", metadata, request.headers.get("user-agent") ?? undefined);
  if (result.source !== "supabase" || !result.data) {
    return NextResponse.json({ ok: false, source: result.source, error: result.error ?? "Follow-up non salvato nel database." }, { status: 503 });
  }

  return NextResponse.json({ ok: true, source: result.source, data: result.data });
}
