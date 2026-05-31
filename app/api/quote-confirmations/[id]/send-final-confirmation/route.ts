import { NextRequest, NextResponse } from "next/server";
import { buildPaymentReason, isPaymentSettingsConfigured, paymentSettingsToDbValue } from "@/lib/payment-settings";
import { getQuoteConfirmationById, updateQuoteConfirmationAvailability } from "@/lib/repositories/quoteConfirmations";
import { trackQuoteEvent } from "@/lib/repositories/quoteEvents";
import { getQuoteById } from "@/lib/repositories/quotes";
import { getPaymentSettings } from "@/lib/repositories/settings";
import { requireAdminApiAccess } from "@/lib/server/auth-guard";
import { sendFinalConfirmationEmailToClient } from "@/lib/server/brevo";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const unauthorized = await requireAdminApiAccess(request);
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => null) as { depositDueAt?: string; notes?: string } | null;
  if (!body?.depositDueAt) return NextResponse.json({ ok: false, error: "Scadenza caparra obbligatoria" }, { status: 400 });

  const confirmationResult = await getQuoteConfirmationById(params.id);
  if (!confirmationResult.data) return NextResponse.json({ ok: false, error: "Conferma non trovata" }, { status: 404 });
  if (confirmationResult.data.availability_status !== "availability_confirmed") {
    return NextResponse.json({ ok: false, error: "Conferma definitiva disponibile solo dopo disponibilità struttura confermata" }, { status: 409 });
  }

  const quoteResult = await getQuoteById(String(confirmationResult.data.quote_id));
  if (!quoteResult.data?.confirmation) return NextResponse.json({ ok: false, error: "Preventivo non trovato" }, { status: 404 });

  const snapshot = await resolvePaymentSnapshot(quoteResult.data);
  const sent = await sendFinalConfirmationEmailToClient(quoteResult.data, {
    depositDueAt: body.depositDueAt,
    notes: body.notes,
    paymentSettingsSnapshot: snapshot
  });
  if (!sent) return NextResponse.json({ ok: false, error: "Email conferma definitiva non inviata" }, { status: 502 });

  const now = new Date().toISOString();
  const update = await updateQuoteConfirmationAvailability(params.id, {
    status: "deposit_waiting",
    depositDueAt: body.depositDueAt,
    finalConfirmationSentAt: now,
    finalConfirmationNotes: body.notes ?? null,
    paymentSettingsSnapshot: snapshot
  });
  if (!update.data) return NextResponse.json({ ok: false, error: update.error ?? "Conferma non aggiornata" }, { status: 500 });

  await trackQuoteEvent(quoteResult.data.id, "deposit_due_at_set", {
    deposit_due_at: body.depositDueAt,
    hotel_name: quoteResult.data.confirmation.selectedHotelName,
    treatment_label: quoteResult.data.confirmation.selectedTreatmentLabel,
    selected_price: quoteResult.data.confirmation.selectedPrice
  });
  await trackQuoteEvent(quoteResult.data.id, "final_confirmation_email_sent", {
    deposit_due_at: body.depositDueAt,
    hotel_name: quoteResult.data.confirmation.selectedHotelName,
    treatment_label: quoteResult.data.confirmation.selectedTreatmentLabel,
    selected_price: quoteResult.data.confirmation.selectedPrice
  });

  return NextResponse.json({ ok: true, source: update.source, data: update.data });
}

async function resolvePaymentSnapshot(quote: NonNullable<Awaited<ReturnType<typeof getQuoteById>>["data"]>) {
  if (quote.confirmation?.paymentSettingsSnapshot?.configured === true) return quote.confirmation.paymentSettingsSnapshot;
  const settings = (await getPaymentSettings()).data;
  const reason = buildPaymentReason(settings, quote.code, quote.customerFirstName, quote.customerLastName);
  return isPaymentSettingsConfigured(settings)
    ? { ...paymentSettingsToDbValue(settings), payment_reason: reason, configured: true }
    : { configured: false, payment_reason: reason, updated_at: settings.updatedAt };
}
