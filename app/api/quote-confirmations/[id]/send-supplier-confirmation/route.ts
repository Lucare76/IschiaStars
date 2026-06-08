import { NextRequest, NextResponse } from "next/server";
import { getQuoteConfirmationById } from "@/lib/repositories/quoteConfirmations";
import { getQuoteEvents, trackQuoteEvent } from "@/lib/repositories/quoteEvents";
import { getQuoteById } from "@/lib/repositories/quotes";
import { requireAdminApiAccess } from "@/lib/server/auth-guard";
import { sendSupplierConfirmationEmail } from "@/lib/server/brevo";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const unauthorized = await requireAdminApiAccess(request);
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => null) as { recipientEmail?: string; netPrice?: number; notes?: string } | null;
  const recipientEmail = body?.recipientEmail?.trim();
  const netPrice = typeof body?.netPrice === "number" ? body.netPrice : Number(body?.netPrice);

  if (!recipientEmail || !EMAIL_PATTERN.test(recipientEmail)) {
    return NextResponse.json({ ok: false, error: "Email destinatario non valida" }, { status: 400 });
  }
  if (!Number.isFinite(netPrice) || netPrice <= 0) {
    return NextResponse.json({ ok: false, error: "Prezzo netto obbligatorio" }, { status: 400 });
  }

  const confirmationResult = await getQuoteConfirmationById(params.id);
  if (!confirmationResult.data) return NextResponse.json({ ok: false, error: "Conferma non trovata" }, { status: 404 });

  const quoteResult = await getQuoteById(String(confirmationResult.data.quote_id));
  const quote = quoteResult.data;
  if (!quote?.confirmation) return NextResponse.json({ ok: false, error: "Preventivo non trovato" }, { status: 404 });

  const sent = await sendSupplierConfirmationEmail({
    to: recipientEmail,
    quote,
    confirmation: quote.confirmation,
    netPrice,
    notes: body?.notes
  });
  if (!sent) return NextResponse.json({ ok: false, error: "Invio email non riuscito. Riprova." }, { status: 500 });

  const sentAt = new Date().toISOString();
  await trackQuoteEvent(quote.id, "supplier_confirmation_sent", { recipientEmail, netPrice, sentAt });

  return NextResponse.json({ success: true, sentAt, recipientEmail });
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const unauthorized = await requireAdminApiAccess(request);
  if (unauthorized) return unauthorized;

  const confirmationResult = await getQuoteConfirmationById(params.id);
  if (!confirmationResult.data) return NextResponse.json({ ok: false, error: "Conferma non trovata" }, { status: 404 });

  const eventsResult = await getQuoteEvents(String(confirmationResult.data.quote_id));
  const lastEvent = [...(eventsResult.data ?? [])]
    .reverse()
    .find((event) => event.eventType === "supplier_confirmation_sent");

  if (!lastEvent) return NextResponse.json({ ok: true, lastSent: null });

  const metadata = lastEvent.metadata ?? {};
  const recipientEmail = typeof metadata.recipientEmail === "string" ? metadata.recipientEmail : null;
  const sentAt = typeof metadata.sentAt === "string" ? metadata.sentAt : lastEvent.createdAt;

  return NextResponse.json({ ok: true, lastSent: recipientEmail ? { recipientEmail, sentAt } : null });
}
