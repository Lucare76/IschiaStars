import { NextRequest, NextResponse } from "next/server";
import { getQuoteConfirmationById } from "@/lib/repositories/quoteConfirmations";
import { getQuoteById } from "@/lib/repositories/quotes";
import { requireAdminApiAccess } from "@/lib/server/auth-guard";
import { generateAndSendVoucherEmail } from "@/lib/server/voucher-email";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const unauthorized = await requireAdminApiAccess(request);
  if (unauthorized) return unauthorized;

  const confirmationResult = await getQuoteConfirmationById(params.id);
  const confirmation = confirmationResult.data;
  if (!confirmation) return NextResponse.json({ ok: false, error: "Conferma non trovata" }, { status: 404 });
  if (!confirmation.deposit_paid_at) {
    return NextResponse.json({ ok: false, error: "Il voucher può essere inviato solo dopo la caparra" }, { status: 409 });
  }

  const quoteResult = await getQuoteById(String(confirmation.quote_id));
  const quote = quoteResult.data;
  if (!quote?.confirmation) return NextResponse.json({ ok: false, error: "Preventivo non trovato" }, { status: 404 });

  const voucherEmail = await generateAndSendVoucherEmail(quote, {
    depositPaidAt: quote.confirmation.depositPaidAt ?? String(confirmation.deposit_paid_at),
    balancePaidAt: quote.confirmation.balancePaidAt ?? undefined,
    isBalancePaid: Boolean(quote.confirmation.balancePaidAt)
  });

  if (!voucherEmail.sent) {
    console.error("[send-voucher] voucher email failed", { quoteId: quote.id, confirmationId: params.id, error: voucherEmail.error });
    return NextResponse.json({
      ok: false,
      paymentSaved: true,
      voucherEmailSent: false,
      voucherEmailError: voucherEmail.error,
      error: voucherEmail.error ?? "Invio voucher non riuscito"
    }, { status: 502 });
  }

  const freshQuoteResult = await getQuoteById(quote.id);
  return NextResponse.json({
    ok: true,
    success: true,
    paymentSaved: true,
    voucherEmailSent: true,
    voucherEmailError: null,
    quote: freshQuoteResult.data
  });
}
