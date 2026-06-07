import { NextRequest, NextResponse } from "next/server";
import { getQuoteConfirmationById, updateQuoteConfirmationAvailability } from "@/lib/repositories/quoteConfirmations";
import { trackQuoteEvent } from "@/lib/repositories/quoteEvents";
import { getQuoteById } from "@/lib/repositories/quotes";
import { requireAdminApiAccess } from "@/lib/server/auth-guard";
import { sendAvailabilityUnavailableEmailToClient } from "@/lib/server/brevo";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const unauthorized = await requireAdminApiAccess(request);
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => null) as { reason?: string; message?: string; alternativeToPropose?: boolean } | null;
  if (!body?.message?.trim()) return NextResponse.json({ ok: false, error: "Testo email obbligatorio" }, { status: 400 });

  const confirmationResult = await getQuoteConfirmationById(params.id);
  if (!confirmationResult.data) return NextResponse.json({ ok: false, error: "Conferma non trovata" }, { status: 404 });

  const quoteResult = await getQuoteById(String(confirmationResult.data.quote_id));
  if (!quoteResult.data) return NextResponse.json({ ok: false, error: "Preventivo non trovato" }, { status: 404 });

  const sent = await sendAvailabilityUnavailableEmailToClient(quoteResult.data, {
    reason: body.reason,
    message: body.message
  });
  if (!sent) return NextResponse.json({ ok: false, error: "Email disponibilità terminata non inviata" }, { status: 502 });

  const nextStatus = body.alternativeToPropose ? "alternative_to_propose" : "availability_unavailable";
  const now = new Date().toISOString();
  const result = await updateQuoteConfirmationAvailability(params.id, {
    status: nextStatus,
    unavailableReason: body.reason ?? null,
    unavailabilityEmailSentAt: now
  });
  if (!result.data) return NextResponse.json({ ok: false, error: result.error ?? "Conferma non aggiornata" }, { status: 500 });

  await trackQuoteEvent(quoteResult.data.id, "availability_unavailable_email_sent", {
    hotel_name: quoteResult.data.confirmation?.selectedHotelName,
    treatment_label: quoteResult.data.confirmation?.selectedTreatmentLabel,
    selected_price: quoteResult.data.confirmation?.selectedPrice,
    unavailable_reason: body.reason
  });
  if (body.alternativeToPropose) {
    await trackQuoteEvent(quoteResult.data.id, "alternative_to_propose", {
      hotel_name: quoteResult.data.confirmation?.selectedHotelName,
      treatment_label: quoteResult.data.confirmation?.selectedTreatmentLabel,
      selected_price: quoteResult.data.confirmation?.selectedPrice,
      unavailable_reason: body.reason
    });
  }

  const freshQuoteResult = await getQuoteById(quoteResult.data.id);
  return NextResponse.json({ ok: true, source: result.source, data: result.data, quote: freshQuoteResult.data });
}
