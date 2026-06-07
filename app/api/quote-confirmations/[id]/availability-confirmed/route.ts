import { NextRequest, NextResponse } from "next/server";
import { defaultDepositDueAt } from "@/lib/confirmation-availability";
import { buildPaymentReason, isPaymentSettingsConfigured, paymentSettingsToDbValue } from "@/lib/payment-settings";
import { updateQuoteConfirmationAvailability, getQuoteConfirmationById } from "@/lib/repositories/quoteConfirmations";
import { trackQuoteEvent } from "@/lib/repositories/quoteEvents";
import { getQuoteById } from "@/lib/repositories/quotes";
import { getPaymentSettings } from "@/lib/repositories/settings";
import { requireAdminApiAccess } from "@/lib/server/auth-guard";
import { sendFinalConfirmationEmailToClient } from "@/lib/server/brevo";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const unauthorized = await requireAdminApiAccess(request);
  if (unauthorized) return unauthorized;

  const confirmationResult = await getQuoteConfirmationById(params.id);
  if (!confirmationResult.data) return NextResponse.json({ ok: false, error: "Conferma non trovata" }, { status: 404 });

  const quoteId = String(confirmationResult.data.quote_id);
  const quoteResult = await getQuoteById(quoteId);
  const result = await updateQuoteConfirmationAvailability(params.id, { status: "availability_confirmed" });
  if (!result.data) return NextResponse.json({ ok: false, error: result.error ?? "Stato non aggiornato" }, { status: 500 });

  await trackQuoteEvent(quoteId, "availability_confirmed", selectionMetadata(confirmationResult.data));

  await sendFinalConfirmationEmailAutomatically(params.id, quoteResult.data);

  const freshQuoteResult = await getQuoteById(quoteId);
  return NextResponse.json({ ok: true, source: result.source, data: result.data, quote: freshQuoteResult.data });
}

async function sendFinalConfirmationEmailAutomatically(confirmationId: string, quote: Awaited<ReturnType<typeof getQuoteById>>["data"]) {
  if (!quote?.confirmation) return;

  try {
    const settings = (await getPaymentSettings()).data;
    if (!isPaymentSettingsConfigured(settings)) {
      console.info(`[availability-confirmed] coordinate pagamento non configurate, invio automatico saltato code=${quote.code}`);
      return;
    }

    const confirmation = quote.confirmation;
    const depositDueAt = defaultDepositDueAt().toISOString();
    const emailSentAt = new Date().toISOString();
    const reason = buildPaymentReason(settings, quote.code, confirmation.firstName ?? quote.customerFirstName, confirmation.lastName ?? quote.customerLastName);
    const snapshot = {
      ...paymentSettingsToDbValue(settings),
      payment_reason: reason,
      deposit_amount: confirmation.selectedDepositAmount ?? quote.deposit,
      balance_amount: confirmation.selectedBalanceAmount,
      deposit_due_at: depositDueAt,
      email_sent_at: emailSentAt,
      configured: true
    };

    const sent = await sendFinalConfirmationEmailToClient(quote, { depositDueAt, paymentSettingsSnapshot: snapshot });
    if (!sent) {
      console.error("Errore invio mail conferma definitiva:", "invio non riuscito");
      return;
    }

    await updateQuoteConfirmationAvailability(confirmationId, {
      status: "availability_confirmed",
      depositDueAt,
      finalConfirmationSentAt: emailSentAt,
      paymentSettingsSnapshot: snapshot
    });
    console.info("Mail conferma definitiva inviata:", confirmation.email ?? quote.customerEmail);
  } catch (error) {
    console.error("Errore invio mail conferma definitiva:", error);
  }
}

function selectionMetadata(row: Record<string, unknown>) {
  return {
    hotel_name: row.selected_hotel_name,
    treatment_label: row.selected_treatment_label,
    selected_price: row.selected_price
  };
}
