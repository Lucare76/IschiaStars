import { NextRequest, NextResponse } from "next/server";
import { getQuoteConfirmationById, updateVoucherNotes } from "@/lib/repositories/quoteConfirmations";
import { getQuoteById } from "@/lib/repositories/quotes";
import { requireAdminApiAccess } from "@/lib/server/auth-guard";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const unauthorized = await requireAdminApiAccess(request);
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => null) as { voucherNotes?: unknown } | null;
  if (typeof body?.voucherNotes !== "string") {
    return NextResponse.json({ success: false, error: "Note voucher non valide" }, { status: 400 });
  }

  const voucherNotes = body.voucherNotes.trim();
  if (voucherNotes.length > 500) {
    return NextResponse.json({ success: false, error: "Le note voucher non possono superare 500 caratteri" }, { status: 400 });
  }

  const confirmationResult = await getQuoteConfirmationById(params.id);
  if (!confirmationResult.data) {
    return NextResponse.json({ success: false, error: "Conferma non trovata" }, { status: 404 });
  }

  const update = await updateVoucherNotes(params.id, voucherNotes || null);
  if (!update.data) {
    return NextResponse.json({ success: false, error: update.error ?? "Note voucher non salvate" }, { status: 500 });
  }

  const quoteResult = await getQuoteById(String(confirmationResult.data.quote_id));
  return NextResponse.json({ success: true, quote: quoteResult.data });
}
