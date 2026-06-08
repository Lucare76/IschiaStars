import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiKey } from "@/lib/admin-api-guard";
import { createQuoteFromRequest, listQuotes } from "@/lib/repositories/quotes";
import { markQuoteRequestProcessed } from "@/lib/repositories/quoteRequests";
import { ADMIN_ACCESS_COOKIE } from "@/lib/server/auth-guard";
import { isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { validateQuoteHotelOptions } from "@/lib/quote-validation";

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdminApiKey(request);
  if (unauthorized) return unauthorized;

  const result = await listQuotes();
  return NextResponse.json(
    { ok: true, source: result.source, data: result.data, error: result.error },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
  );
}

export async function POST(request: NextRequest) {
  console.info("POST /api/quotes start");
  const unauthorized = await requireAdminApiKey(request);
  console.info("POST /api/quotes auth", { ok: !unauthorized, status: unauthorized?.status ?? 200 });
  if (unauthorized) return unauthorized;

  console.info("POST /api/quotes supabase", {
    configured: isSupabaseConfigured(),
    serviceRoleConfigured: isSupabaseAdminConfigured()
  });

  const body = await request.json().catch(() => null);
  if (!body?.clientFirstName || !body?.clientPhone || !body?.checkIn || !body?.checkOut) {
    return NextResponse.json({ ok: false, error: "Dati preventivo incompleti" }, { status: 400 });
  }

  const hotelOptionsValidation = validateQuoteHotelOptions(body.hotelOptions, { requirePrice: true });
  if (!hotelOptionsValidation.ok) {
    return NextResponse.json({ ok: false, error: hotelOptionsValidation.error }, { status: 400 });
  }

  const accessToken = request.cookies.get(ADMIN_ACCESS_COOKIE)?.value;
  const result = await createQuoteFromRequest({
    quoteRequestId: body.quoteRequestId,
    code: body.code,
    publicToken: body.publicToken,
    status: "in_lavorazione",
    clientFirstName: body.clientFirstName,
    clientLastName: body.clientLastName,
    clientEmail: body.clientEmail,
    clientPhone: body.clientPhone,
    hotelRequested: body.hotelRequested,
    hotelId: body.hotelId,
    alternativeHotelId: body.alternativeHotelId,
    isAlternativeOffer: Boolean(body.isAlternativeOffer),
    checkIn: body.checkIn,
    checkOut: body.checkOut,
    adults: Number(body.adults ?? 2),
    children: body.children ?? [],
    rooms: Number(body.rooms ?? 1),
    treatment: body.treatment,
    totalPrice: Number(body.totalPrice ?? 0),
    depositAmount: Number(body.depositAmount ?? 0),
    validUntil: body.validUntil,
    includedServices: body.includedServices ?? [],
    transportOffers: body.transportOffers ?? [],
    paymentPolicy: body.paymentPolicy,
    cancellationPolicy: body.cancellationPolicy,
    publicNotes: body.publicNotes,
    internalNotes: body.internalNotes,
    hotelOptions: body.hotelOptions ?? undefined
  }, { accessToken, isLabTest: Boolean(body.isLabTest) });

  if (!result.data && result.error) {
    console.error("POST /api/quotes repository error", { error: result.error });
  }

  if (result.data && isUuid(body.quoteRequestId)) {
    const statusResult = await markQuoteRequestProcessed(body.quoteRequestId, result.data.id, { accessToken });
    if (!statusResult.data && statusResult.error) {
      console.error("POST /api/quotes request status error", { error: statusResult.error });
    }
  }

  if (result.data) return NextResponse.json({ ok: true, source: result.source, data: result.data });

  const error = result.error ?? "Sistema non configurato per il salvataggio. Verifica le variabili ambiente.";
  return NextResponse.json({ ok: false, source: result.source, data: result.data, error }, { status: 503 });
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
