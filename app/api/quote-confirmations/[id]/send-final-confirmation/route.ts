import { NextRequest, NextResponse } from "next/server";
import { defaultPaymentDueAtForFinalConfirmation } from "@/lib/confirmation-availability";
import { getEffectiveBalancePaymentSchedule, isBalanceDueAtConfirmation } from "@/lib/hotel-policies";
import { buildBalancePaymentReason, buildPaymentReason, isPaymentSettingsConfigured, paymentSettingsToDbValue } from "@/lib/payment-settings";
import { getQuoteConfirmationById, updateConfirmationAmounts, updateQuoteConfirmationAvailability } from "@/lib/repositories/quoteConfirmations";
import { trackQuoteEvent } from "@/lib/repositories/quoteEvents";
import { getQuoteById } from "@/lib/repositories/quotes";
import { getPaymentSettings } from "@/lib/repositories/settings";
import { requireAdminApiAccess } from "@/lib/server/auth-guard";
import { sendFinalConfirmationEmailToClient } from "@/lib/server/brevo";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const unauthorized = await requireAdminApiAccess(request);
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => null) as { depositDueAt?: string; notes?: string; depositAmountOverride?: number; balanceAmountOverride?: number } | null;
  if (!body?.depositDueAt) return NextResponse.json({ ok: false, error: "Scadenza caparra obbligatoria" }, { status: 400 });

  const confirmationResult = await getQuoteConfirmationById(params.id);
  if (!confirmationResult.data) return NextResponse.json({ ok: false, error: "Conferma non trovata" }, { status: 404 });
  if (confirmationResult.data.availability_status !== "availability_confirmed") {
    return NextResponse.json({ ok: false, error: "Conferma definitiva disponibile solo dopo disponibilità struttura confermata" }, { status: 409 });
  }

  const quoteResult = await getQuoteById(String(confirmationResult.data.quote_id));
  if (!quoteResult.data?.confirmation) return NextResponse.json({ ok: false, error: "Preventivo non trovato" }, { status: 404 });

  const now = new Date().toISOString();
  const effectiveDepositDueAt = resolveEffectivePaymentDueAt(quoteResult.data, body.depositDueAt, new Date(now));
  const depositAmountOverride = typeof body.depositAmountOverride === "number" && body.depositAmountOverride > 0 ? body.depositAmountOverride : undefined;
  const balanceAmountOverride = typeof body.balanceAmountOverride === "number" && body.balanceAmountOverride > 0 ? body.balanceAmountOverride : undefined;
  const snapshot = await resolvePaymentSnapshot(quoteResult.data, effectiveDepositDueAt, now, depositAmountOverride, balanceAmountOverride);
  if (snapshot.configured !== true) {
    return NextResponse.json({ ok: false, error: "Coordinate pagamento non configurate. Completa le impostazioni prima di inviare la conferma definitiva." }, { status: 400 });
  }

  const sent = await sendFinalConfirmationEmailToClient(quoteResult.data, {
    depositDueAt: effectiveDepositDueAt,
    notes: body.notes,
    paymentSettingsSnapshot: snapshot
  });
  if (!sent) return NextResponse.json({ ok: false, error: "Email conferma definitiva non inviata" }, { status: 502 });

  const update = await updateQuoteConfirmationAvailability(params.id, {
    status: "deposit_waiting",
    depositDueAt: effectiveDepositDueAt,
    finalConfirmationSentAt: now,
    finalConfirmationNotes: body.notes ?? null,
    paymentSettingsSnapshot: snapshot
  });

  if (depositAmountOverride !== undefined || balanceAmountOverride !== undefined) {
    const totalPrice = quoteResult.data.confirmation?.selectedPrice ?? quoteResult.data.totalPrice ?? 0;
    const newDeposit = depositAmountOverride ?? quoteResult.data.confirmation?.selectedDepositAmount ?? quoteResult.data.deposit ?? 0;
    const newBalance = balanceAmountOverride ?? (totalPrice > newDeposit ? totalPrice - newDeposit : null);
    const amountsUpdate = await updateConfirmationAmounts(params.id, newDeposit, newBalance);
    if (!amountsUpdate.data) {
      return NextResponse.json({
        ok: false,
        error: "Email inviata, ma gli importi non sono stati aggiornati. Verifica il dettaglio della conferma."
      }, { status: 500 });
    }
  }
  if (!update.data) return NextResponse.json({ ok: false, error: update.error ?? "Conferma non aggiornata" }, { status: 500 });

  await trackQuoteEvent(quoteResult.data.id, "deposit_due_at_set", {
    deposit_due_at: effectiveDepositDueAt,
    hotel_name: quoteResult.data.confirmation.selectedHotelName,
    treatment_label: quoteResult.data.confirmation.selectedTreatmentLabel,
    selected_price: quoteResult.data.confirmation.selectedPrice
  });
  await trackQuoteEvent(quoteResult.data.id, "final_confirmation_email_sent", {
    deposit_due_at: effectiveDepositDueAt,
    hotel_name: quoteResult.data.confirmation.selectedHotelName,
    treatment_label: quoteResult.data.confirmation.selectedTreatmentLabel,
    selected_price: quoteResult.data.confirmation.selectedPrice
  });

  const freshQuoteResult = await getQuoteById(quoteResult.data.id);
  return NextResponse.json({ ok: true, source: update.source, data: update.data, quote: freshQuoteResult.data });
}

async function resolvePaymentSnapshot(quote: NonNullable<Awaited<ReturnType<typeof getQuoteById>>["data"]>, depositDueAt: string, emailSentAt: string, depositAmountOverride?: number, balanceAmountOverride?: number) {
  const settings = (await getPaymentSettings()).data;
  const firstName = quote.confirmation?.firstName ?? quote.customerFirstName;
  const lastName = quote.confirmation?.lastName ?? quote.customerLastName;
  const paymentRequest = getPaymentRequestForQuote(quote, new Date(emailSentAt));
  const reason = paymentRequest.type === "full_balance"
    ? buildBalancePaymentReason(settings, quote.code, firstName, lastName)
    : buildPaymentReason(settings, quote.code, firstName, lastName);
  const depositAmount = depositAmountOverride ?? quote.confirmation?.selectedDepositAmount ?? quote.deposit;
  const totalPrice = quote.confirmation?.selectedPrice ?? quote.totalPrice ?? 0;
  const balanceAmount = balanceAmountOverride
    ?? (depositAmountOverride !== undefined ? (totalPrice > depositAmountOverride ? totalPrice - depositAmountOverride : null) : null)
    ?? quote.confirmation?.selectedBalanceAmount;
  const base = {
    payment_reason: reason,
    deposit_amount: depositAmount,
    balance_amount: balanceAmount,
    deposit_due_at: depositDueAt,
    payment_request_type: paymentRequest.type,
    payment_request_amount: paymentRequest.type === "full_balance" ? totalPrice : depositAmount,
    payment_due_at: paymentRequest.type === "full_balance" ? depositDueAt : null,
    email_sent_at: emailSentAt
  };

  return isPaymentSettingsConfigured(settings)
    ? { ...paymentSettingsToDbValue(settings), ...base, configured: true }
    : { ...base, configured: false, updated_at: settings.updatedAt };
}

function resolveEffectivePaymentDueAt(quote: NonNullable<Awaited<ReturnType<typeof getQuoteById>>["data"]>, requestedDueAt: string, now: Date) {
  const paymentRequest = getPaymentRequestForQuote(quote, now);
  if (paymentRequest.type === "full_balance") return now.toISOString();
  return requestedDueAt;
}

function getPaymentRequestForQuote(quote: NonNullable<Awaited<ReturnType<typeof getQuoteById>>["data"]>, now: Date) {
  const hotelName = quote.confirmation?.selectedHotelName ?? quote.proposedHotel.name;
  const schedule = getEffectiveBalancePaymentSchedule({
    balanceMethod: quote.confirmation?.selectedBalanceMethod,
    arrivalDate: quote.arrivalDate,
    hotelName
  });
  const fallbackDueAt = defaultPaymentDueAtForFinalConfirmation({
    arrivalDate: quote.arrivalDate,
    balanceMethod: quote.confirmation?.selectedBalanceMethod,
    hotelName,
    now
  });
  return {
    type: isBalanceDueAtConfirmation(schedule, now) ? "full_balance" as const : "deposit" as const,
    dueAt: fallbackDueAt.toISOString()
  };
}
