import { NextRequest, NextResponse } from "next/server";
import { updateQuoteConfirmationAvailability, getQuoteConfirmationById } from "@/lib/repositories/quoteConfirmations";
import { trackQuoteEvent } from "@/lib/repositories/quoteEvents";
import { getQuoteById } from "@/lib/repositories/quotes";
import { requireAdminApiAccess } from "@/lib/server/auth-guard";

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

  return NextResponse.json({ ok: true, source: result.source, data: result.data, quote: quoteResult.data });
}

function selectionMetadata(row: Record<string, unknown>) {
  return {
    hotel_name: row.selected_hotel_name,
    treatment_label: row.selected_treatment_label,
    selected_price: row.selected_price
  };
}
