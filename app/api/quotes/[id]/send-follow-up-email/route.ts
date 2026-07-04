import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/server/auth-guard";
import { getQuoteById } from "@/lib/repositories/quotes";
import { sendFollowUpEmailToClient } from "@/lib/server/brevo";
import { trackQuoteEvent } from "@/lib/repositories/quoteEvents";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const unauthorized = await requireAdminApiAccess(request);
  if (unauthorized) return unauthorized;

  const quoteResult = await getQuoteById(params.id);
  const quote = quoteResult.data;
  if (!quote || quote.deletedAt) {
    return NextResponse.json({ ok: false, error: "Preventivo non trovato" }, { status: 404 });
  }

  if (!quote.customerEmail?.trim()) {
    return NextResponse.json({ ok: false, error: "Email cliente assente" }, { status: 400 });
  }

  const result = await sendFollowUpEmailToClient(quote);
  if (!result.sent) {
    const error = result.skipReason === "missing_client_email"
      ? "Email cliente assente"
      : result.error ?? "Invio email non riuscito";
    return NextResponse.json({ ok: false, error }, { status: 502 });
  }

  await trackQuoteEvent(quote.id, "follow_up_whatsapp_click", {
    action: "email",
    source: "admin_follow_up",
    quote_code: quote.code,
    client_email: quote.customerEmail
  }, request.headers.get("user-agent") ?? undefined);

  return NextResponse.json({ ok: true });
}
