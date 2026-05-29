import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiKey } from "@/lib/admin-api-guard";
import { createQuoteRequest, listQuoteRequests } from "@/lib/repositories/quoteRequests";

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdminApiKey(request);
  if (unauthorized) return unauthorized;

  const result = await listQuoteRequests();
  return NextResponse.json({ ok: true, source: result.source, data: result.data, error: result.error });
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminApiKey(request);
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => null);
  if (!body?.firstName || !body?.lastName || !body?.email || !body?.phone || !body?.checkIn || !body?.checkOut) {
    return NextResponse.json({ ok: false, error: "Dati richiesta incompleti" }, { status: 400 });
  }

  const result = await createQuoteRequest({
    firstName: body.firstName,
    lastName: body.lastName,
    email: body.email,
    phone: body.phone,
    destination: body.destination,
    checkIn: body.checkIn,
    checkOut: body.checkOut,
    adults: Number(body.adults ?? 2),
    children: Array.isArray(body.children) ? body.children.map((child: Record<string, string>) => ({ birthDate: child.birthDate ?? child.birth_date, firstName: child.firstName })) : [],
    rooms: Number(body.rooms ?? 1),
    treatment: body.treatment,
    message: body.message,
    metadata: body.metadata ?? {}
  });

  return NextResponse.json({ ok: Boolean(result.data), source: result.source, data: result.data, error: result.error }, { status: result.data ? 200 : 503 });
}
