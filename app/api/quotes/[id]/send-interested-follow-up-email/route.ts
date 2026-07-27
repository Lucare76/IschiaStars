import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/server/auth-guard";
import { getQuoteById } from "@/lib/repositories/quotes";
import { trackQuoteEvent } from "@/lib/repositories/quoteEvents";
import { sendInterestedFollowUpEmailToClient } from "@/lib/server/brevo";

type Body = {
  hotelName?: unknown;
};

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const unauthorized = await requireAdminApiAccess(request);
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => null) as Body | null;
  const hotelName = typeof body?.hotelName === "string" ? body.hotelName.trim() : "";
  if (!hotelName) {
    return NextResponse.json({ ok: false, error: "Struttura non indicata" }, { status: 400 });
  }

  const quoteResult = await getQuoteById(params.id);
  const quote = quoteResult.data;
  if (!quote || quote.deletedAt) {
    return NextResponse.json({ ok: false, error: "Preventivo non trovato" }, { status: 404 });
  }

  if (!quote.customerEmail?.trim()) {
    return NextResponse.json({ ok: false, error: "Email cliente assente" }, { status: 400 });
  }

  const result = await sendInterestedFollowUpEmailToClient(quote, hotelName);
  if (!result.sent) {
    const error = result.skipReason === "missing_client_email"
      ? "Email cliente assente"
      : result.error ?? "Invio email non riuscito";
    return NextResponse.json({ ok: false, error }, { status: 502 });
  }

  const eventResult = await trackQuoteEvent(quote.id, "follow_up_whatsapp_click", {
    action: "email_interested",
    source: "admin_interested_reaction",
    quote_code: quote.code,
    client_email: quote.customerEmail,
    hotel_name: hotelName
  }, request.headers.get("user-agent") ?? undefined);
  if (eventResult.source !== "supabase" || !eventResult.data) {
    return NextResponse.json({
      ok: false,
      error: "Email inviata, ma follow-up non salvato nei log. Verifica prima di reinviare."
    }, { status: 502 });
  }

  return NextResponse.json({ ok: true, source: eventResult.source, data: eventResult.data });
}
