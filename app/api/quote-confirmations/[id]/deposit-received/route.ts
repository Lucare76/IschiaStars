import { NextRequest, NextResponse } from "next/server";
import { getQuoteConfirmationById, markDepositPaid, updateQuoteConfirmationAvailability } from "@/lib/repositories/quoteConfirmations";
import { getQuoteById } from "@/lib/repositories/quotes";
import { requireAdminApiAccess } from "@/lib/server/auth-guard";
import { generateAndSendVoucherEmail } from "@/lib/server/voucher-email";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const unauthorized = await requireAdminApiAccess(request);
  if (unauthorized) return unauthorized;

  const confirmationResult = await getQuoteConfirmationById(params.id);
  if (!confirmationResult.data) return NextResponse.json({ ok: false, error: "Conferma non trovata" }, { status: 404 });
  const isLegacyFinalConfirmation = confirmationResult.data.availability_status === "availability_confirmed"
    && Boolean(confirmationResult.data.final_confirmation_sent_at);
  if (confirmationResult.data.availability_status !== "deposit_waiting" && !isLegacyFinalConfirmation) {
    return NextResponse.json({ ok: false, error: "La caparra può essere registrata solo dopo l'invio della conferma definitiva" }, { status: 409 });
  }
  if (isLegacyFinalConfirmation) {
    const statusUpdate = await updateQuoteConfirmationAvailability(params.id, { status: "deposit_waiting" });
    if (!statusUpdate.data) {
      return NextResponse.json({ ok: false, error: statusUpdate.error ?? "Stato conferma non aggiornato" }, { status: 500 });
    }
  }

  const quoteResult = await getQuoteById(String(confirmationResult.data.quote_id));
  const quote = quoteResult.data;
  if (!quote?.confirmation) return NextResponse.json({ ok: false, error: "Preventivo non trovato" }, { status: 404 });

  const update = await markDepositPaid(params.id);
  if (!update.data) return NextResponse.json({ ok: false, error: update.error ?? "Caparra non registrata" }, { status: 500 });

  const depositPaidAt = String(update.data.deposit_paid_at);
  const voucherEmail = await generateAndSendVoucherEmail(quote, { depositPaidAt });
  if (!voucherEmail.sent) {
    console.error("[deposit-received] voucher email failed", { quoteId: quote.id, confirmationId: params.id, error: voucherEmail.error });
  }

  const freshQuoteResult = await getQuoteById(quote.id);
  return NextResponse.json({
    success: true,
    ok: true,
    paymentSaved: true,
    voucherEmailSent: voucherEmail.sent,
    voucherEmailError: voucherEmail.error,
    depositPaidAt,
    quote: freshQuoteResult.data
  });
}
