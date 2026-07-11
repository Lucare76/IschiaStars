import { NextRequest, NextResponse } from "next/server";
import { getQuoteConfirmationById } from "@/lib/repositories/quoteConfirmations";
import { getQuoteById } from "@/lib/repositories/quotes";
import { requireAdminApiAccess } from "@/lib/server/auth-guard";
import { sendDepositBalanceSummaryEmailToClient } from "@/lib/server/brevo";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const unauthorized = await requireAdminApiAccess(request);
  if (unauthorized) return unauthorized;

  const confirmationResult = await getQuoteConfirmationById(params.id);
  const confirmation = confirmationResult.data;
  if (!confirmation) return NextResponse.json({ ok: false, error: "Conferma non trovata" }, { status: 404 });
  if (!confirmation.deposit_paid_at) {
    return NextResponse.json({ ok: false, error: "Il riepilogo può essere inviato solo dopo la caparra" }, { status: 409 });
  }
  if (confirmation.balance_paid_at) {
    return NextResponse.json({ ok: false, error: "Il saldo risulta già registrato" }, { status: 409 });
  }

  const quoteResult = await getQuoteById(String(confirmation.quote_id));
  const quote = quoteResult.data;
  if (!quote?.confirmation) return NextResponse.json({ ok: false, error: "Preventivo non trovato" }, { status: 404 });

  const sent = await sendDepositBalanceSummaryEmailToClient(quote);
  if (!sent) {
    return NextResponse.json({ ok: false, error: "Email riepilogo saldo non inviata" }, { status: 502 });
  }

  return NextResponse.json({ ok: true, success: true, message: "Riepilogo saldo inviato via email", quote });
}
