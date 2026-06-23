import { NextRequest, NextResponse } from "next/server";
import { getQuoteConfirmationById, markBalancePaid } from "@/lib/repositories/quoteConfirmations";
import { getQuoteById } from "@/lib/repositories/quotes";
import { requireAdminApiAccess } from "@/lib/server/auth-guard";
import { generateAndSendVoucherEmail } from "@/lib/server/voucher-email";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const unauthorized = await requireAdminApiAccess(request);
  if (unauthorized) return unauthorized;

  const confirmationResult = await getQuoteConfirmationById(params.id);
  if (!confirmationResult.data) return NextResponse.json({ ok: false, error: "Conferma non trovata" }, { status: 404 });
  if (!confirmationResult.data.deposit_paid_at) {
    return NextResponse.json({ ok: false, error: "Il saldo può essere registrato solo dopo la caparra" }, { status: 409 });
  }

  const quoteResult = await getQuoteById(String(confirmationResult.data.quote_id));
  const quote = quoteResult.data;
  if (!quote?.confirmation) return NextResponse.json({ ok: false, error: "Preventivo non trovato" }, { status: 404 });

  const update = await markBalancePaid(params.id);
  if (!update.data) return NextResponse.json({ ok: false, error: update.error ?? "Saldo non registrato" }, { status: 500 });

  const balancePaidAt = String(update.data.balance_paid_at ?? new Date().toISOString());
  const depositPaidAt = quote.confirmation.depositPaidAt ?? balancePaidAt;
  const voucherEmail = await generateAndSendVoucherEmail(quote, {
    depositPaidAt,
    balancePaidAt,
    isBalancePaid: true
  });
  if (!voucherEmail.sent) {
    console.error("[balance-received] voucher email failed", { quoteId: quote.id, confirmationId: params.id, error: voucherEmail.error });
  }

  const freshQuoteResult = await getQuoteById(quote.id);
  return NextResponse.json({
    ok: true,
    success: true,
    paymentSaved: true,
    voucherEmailSent: voucherEmail.sent,
    voucherEmailError: voucherEmail.error,
    balancePaidAt,
    quote: freshQuoteResult.data
  });
}
