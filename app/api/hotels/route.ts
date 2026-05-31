import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiKey } from "@/lib/admin-api-guard";
import { createHotel, listHotels } from "@/lib/repositories/hotels";

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdminApiKey(request);
  if (unauthorized) return unauthorized;

  const result = await listHotels();
  return NextResponse.json({ ok: true, source: result.source, data: result.data, error: result.error });
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminApiKey(request);
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => null);
  if (!body?.name || !body?.location || !body?.stars) {
    return NextResponse.json({ ok: false, error: "Nome, localita e stelle sono obbligatori" }, { status: 400 });
  }

  const result = await createHotel({
    name: body.name,
    location: body.location,
    stars: Number(body.stars),
    shortDescription: body.shortDescription,
    imageUrl: body.imageUrl,
    standardServices: body.standardServices ?? [],
    defaultDepositPercent: body.defaultDepositPercent !== undefined ? Number(body.defaultDepositPercent) : undefined,
    defaultBalanceMethod: body.defaultBalanceMethod,
    defaultPaymentNotes: body.defaultPaymentNotes,
    paymentPolicy: body.paymentPolicy,
    cancellationPolicy: body.cancellationPolicy,
    internalNotes: body.internalNotes,
    isActive: body.isActive ?? true
  });

  return NextResponse.json({ ok: Boolean(result.data), source: result.source, data: result.data, error: result.error }, { status: result.data ? 200 : 503 });
}
