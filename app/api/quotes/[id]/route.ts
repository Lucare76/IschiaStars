import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/server/auth-guard";
import { duplicateQuote, excludeQuoteFromStats, getQuoteById, restoreQuote, softDeleteQuote, updateQuote, updateQuoteStatus } from "@/lib/repositories/quotes";
import { validateQuoteHotelOptions } from "@/lib/quote-validation";
import { sendQuoteEmailToClient } from "@/lib/server/brevo";
import { QuoteStatus } from "@/lib/types";

const statuses: QuoteStatus[] = ["da_evadere", "in_lavorazione", "preventivo_inviato", "confermato", "perso_non_disponibile"];

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const unauthorized = await requireAdminApiAccess(request);
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Payload non valido" }, { status: 400 });

  if (body.statusOnly) {
    if (!statuses.includes(body.status)) return NextResponse.json({ ok: false, error: "Stato non valido" }, { status: 400 });
    const result = await updateQuoteStatus(params.id, body.status);
    return quoteMutationResponse(result);
  }

  if (body.excludedFromStats !== undefined) {
    const result = await excludeQuoteFromStats(params.id, Boolean(body.excludedFromStats));
    return quoteMutationResponse(result);
  }

  if (body.softDelete) {
    const result = await softDeleteQuote(params.id, body.deletedReason);
    return quoteMutationResponse(result);
  }

  const hotelOptionsValidation = validateQuoteHotelOptions(body.hotelOptions, { requirePrice: false });
  if (!hotelOptionsValidation.ok) {
    return NextResponse.json({ ok: false, error: hotelOptionsValidation.error }, { status: 400 });
  }

  const result = await updateQuote(params.id, {
    clientFirstName: body.clientFirstName,
    clientLastName: body.clientLastName,
    clientEmail: body.clientEmail,
    clientPhone: body.clientPhone,
    hotelRequested: body.hotelRequested,
    hotelId: body.hotelId,
    alternativeHotelId: body.alternativeHotelId,
    isAlternativeOffer: body.isAlternativeOffer,
    checkIn: body.checkIn,
    checkOut: body.checkOut,
    adults: body.adults !== undefined ? Number(body.adults) : undefined,
    rooms: body.rooms !== undefined ? Number(body.rooms) : undefined,
    treatment: body.treatment,
    totalPrice: body.totalPrice !== undefined ? Number(body.totalPrice) : undefined,
    depositAmount: body.depositAmount !== undefined ? Number(body.depositAmount) : undefined,
    validUntil: body.validUntil,
    includedServices: body.includedServices,
    transportOffers: body.transportOffers,
    paymentPolicy: body.paymentPolicy,
    cancellationPolicy: body.cancellationPolicy,
    publicNotes: body.publicNotes,
    internalNotes: body.internalNotes,
    requiresCommitment: body.requiresCommitment !== undefined ? Boolean(body.requiresCommitment) : undefined,
    hotelOptions: body.hotelOptions ?? undefined
  });

  return quoteMutationResponse(result);
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const unauthorized = await requireAdminApiAccess(request);
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => null);

  if (body?.action === "duplicate") {
    const result = await duplicateQuote(params.id);
    return quoteMutationResponse(result);
  }

  if (body?.action === "restore") {
    const result = await restoreQuote(params.id);
    return quoteMutationResponse(result);
  }

  if (body?.action === "send") {
    const quoteResult = await getQuoteById(params.id);
    if (quoteResult.source !== "supabase") return quoteMutationResponse(quoteResult);
    if (!quoteResult.data) return NextResponse.json({ ok: false, source: quoteResult.source, data: null, error: "Preventivo non trovato" }, { status: 404 });

    try {
      const emailResult = await sendQuoteEmailToClient(quoteResult.data);
      if (!emailResult.sent) {
        return NextResponse.json({
          ok: false,
          source: quoteResult.source,
          data: quoteResult.data,
          error: `Email non inviata: ${emailResult.skipReason ?? "motivo sconosciuto"}`
        }, { status: 400 });
      }
    } catch (err) {
      return NextResponse.json({
        ok: false,
        source: quoteResult.source,
        data: quoteResult.data,
        error: err instanceof Error ? err.message : "Errore durante l'invio email"
      }, { status: 500 });
    }

    const statusResult = await updateQuoteStatus(params.id, "preventivo_inviato");
    return quoteMutationResponse(statusResult);
  }

  return NextResponse.json({ ok: false, error: "Azione non valida" }, { status: 400 });
}

function quoteMutationResponse<T extends { id?: string }>(result: { data: T | null; source: "supabase" | "mock"; error?: string }) {
  if (result.source !== "supabase") {
    return NextResponse.json({
      ok: false,
      source: result.source,
      data: null,
      error: result.error ?? "Database non collegato: modifica non salvata."
    }, { status: 503 });
  }

  return NextResponse.json({
    ok: Boolean(result.data),
    source: result.source,
    data: result.data,
    error: result.error
  }, { status: result.data ? 200 : 400 });
}
