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

  const body = await request.json().catch(() => null) as { recipientEmail?: string; grossPrice?: number; netPrice?: number; commission?: number; notes?: string } | null;
  const recipientEmail = body?.recipientEmail?.trim();
  const grossPrice = body?.grossPrice == null ? undefined : (typeof body.grossPrice === "number" ? body.grossPrice : Number(body.grossPrice));
  const netPrice = body?.netPrice == null ? undefined : (typeof body.netPrice === "number" ? body.netPrice : Number(body.netPrice));
  const commission = body?.commission == null ? undefined : (typeof body.commission === "number" ? body.commission : Number(body.commission));

  if (!recipientEmail || !EMAIL_PATTERN.test(recipientEmail)) {
    return NextResponse.json({ ok: false, error: "Email destinatario non valida" }, { status: 400 });
  }
  if (grossPrice !== undefined && (!Number.isFinite(grossPrice) || grossPrice <= 0)) {
    return NextResponse.json({ ok: false, error: "Costo lordo non valido" }, { status: 400 });
  }
  if (netPrice !== undefined && (!Number.isFinite(netPrice) || netPrice <= 0)) {
    return NextResponse.json({ ok: false, error: "Costo netto non valido" }, { status: 400 });
  }
  if (commission !== undefined && (!Number.isFinite(commission) || commission < 0)) {
    return NextResponse.json({ ok: false, error: "Commissione trattenuta non valida" }, { status: 400 });
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
    grossPrice,
    netPrice,
    commission,
    notes: body?.notes
  });
  if (!sent) return NextResponse.json({ ok: false, error: "Invio email non riuscito. Riprova." }, { status: 500 });

  const sentAt = new Date().toISOString();
  await trackQuoteEvent(quote.id, "supplier_confirmation_sent", {
    recipientEmail,
    ...(grossPrice !== undefined ? { grossPrice } : {}),
    ...(netPrice !== undefined ? { netPrice } : {}),
    ...(commission !== undefined ? { commission } : {}),
    sentAt
  });

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
