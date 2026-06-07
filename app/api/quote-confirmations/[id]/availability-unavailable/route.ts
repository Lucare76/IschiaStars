import { NextRequest, NextResponse } from "next/server";
import { getQuoteConfirmationById, updateQuoteConfirmationAvailability } from "@/lib/repositories/quoteConfirmations";
import { trackQuoteEvent } from "@/lib/repositories/quoteEvents";
import { getQuoteById } from "@/lib/repositories/quotes";
import { requireAdminApiAccess } from "@/lib/server/auth-guard";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const unauthorized = await requireAdminApiAccess(request);
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => null) as { reason?: string; alternativeToPropose?: boolean } | null;
  const confirmationResult = await getQuoteConfirmationById(params.id);
  if (!confirmationResult.data) return NextResponse.json({ ok: false, error: "Conferma non trovata" }, { status: 404 });

  const quoteId = String(confirmationResult.data.quote_id);
  const status = body?.alternativeToPropose ? "alternative_to_propose" : "availability_unavailable";
  const result = await updateQuoteConfirmationAvailability(params.id, {
    status,
    unavailableReason: body?.reason ?? null
  });
  if (!result.data) return NextResponse.json({ ok: false, error: result.error ?? "Stato non aggiornato" }, { status: 500 });

  await trackQuoteEvent(quoteId, status === "alternative_to_propose" ? "alternative_to_propose" : "availability_unavailable", {
    hotel_name: confirmationResult.data.selected_hotel_name,
    treatment_label: confirmationResult.data.selected_treatment_label,
    selected_price: confirmationResult.data.selected_price,
    unavailable_reason: body?.reason
  });

  const quoteResult = await getQuoteById(quoteId);
  return NextResponse.json({ ok: true, source: result.source, data: result.data, quote: quoteResult.data });
}
