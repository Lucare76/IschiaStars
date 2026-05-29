import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/server/auth-guard";
import { duplicateQuote, updateQuote, updateQuoteStatus } from "@/lib/repositories/quotes";
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
    return NextResponse.json({ ok: Boolean(result.data), source: result.source, data: result.data, error: result.error }, { status: result.data ? 200 : 400 });
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
    internalNotes: body.internalNotes
  });

  return NextResponse.json({ ok: Boolean(result.data), source: result.source, data: result.data, error: result.error }, { status: result.data ? 200 : 400 });
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const unauthorized = await requireAdminApiAccess(request);
  if (unauthorized) return unauthorized;

  // Action endpoint. Currently supports quote duplication.
  const body = await request.json().catch(() => null);
  if (body?.action !== "duplicate") return NextResponse.json({ ok: false, error: "Azione non valida" }, { status: 400 });

  const result = await duplicateQuote(params.id);
  return NextResponse.json({ ok: Boolean(result.data), source: result.source, data: result.data, error: result.error }, { status: result.data ? 200 : 400 });
}
