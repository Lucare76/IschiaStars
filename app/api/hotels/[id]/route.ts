import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/server/auth-guard";
import { deleteHotel, updateHotel } from "@/lib/repositories/hotels";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const unauthorized = await requireAdminApiAccess(request);
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Payload non valido" }, { status: 400 });

  const result = await updateHotel(params.id, {
    name: body.name,
    location: body.location,
    stars: body.stars !== undefined ? Number(body.stars) : undefined,
    shortDescription: body.shortDescription,
    imageUrl: body.imageUrl,
    standardServices: body.standardServices,
    defaultDepositPercent: parseOptionalNumber(body.defaultDepositPercent),
    defaultBalanceMethod: body.defaultBalanceMethod,
    defaultPaymentNotes: body.defaultPaymentNotes,
    paymentPolicy: body.paymentPolicy,
    cancellationPolicy: body.cancellationPolicy,
    internalNotes: body.internalNotes,
    isActive: body.isActive,
    slug: body.slug,
    sourceUrl: body.sourceUrl
  });

  return NextResponse.json({ ok: Boolean(result.data), source: result.source, data: result.data, error: result.error }, { status: result.data ? 200 : 400 });
}

function parseOptionalNumber(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  return Number(value);
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const unauthorized = await requireAdminApiAccess(request);
  if (unauthorized) return unauthorized;

  const result = await deleteHotel(params.id);
  const ok = result.data.deleted;
  return NextResponse.json({ ok, source: result.source, data: result.data, error: result.error ?? result.data.reason }, { status: ok ? 200 : 409 });
}
