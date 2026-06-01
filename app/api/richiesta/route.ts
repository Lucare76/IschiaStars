import { NextRequest, NextResponse } from "next/server";
import { createQuoteRequest } from "@/lib/repositories/quoteRequests";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "Richiesta non valida" }, { status: 400 });
  }

  const { firstName, lastName, email, phone, checkIn, checkOut } = body;
  if (!firstName || !lastName || !email || !phone || !checkIn || !checkOut) {
    return NextResponse.json({ ok: false, error: "Compila tutti i campi obbligatori" }, { status: 400 });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
    return NextResponse.json({ ok: false, error: "Indirizzo email non valido" }, { status: 400 });
  }

  if (new Date(checkOut) <= new Date(checkIn)) {
    return NextResponse.json({ ok: false, error: "La data di partenza deve essere successiva all'arrivo" }, { status: 400 });
  }

  const children = Array.isArray(body.children)
    ? body.children.map((c: Record<string, unknown>) => ({
        age: c.age != null ? Number(c.age) : undefined,
        birthDate: typeof c.birthDate === "string" ? c.birthDate : typeof c.birth_date === "string" ? c.birth_date : undefined,
        firstName: typeof c.firstName === "string" ? c.firstName : undefined
      }))
    : [];

  const result = await createQuoteRequest({
    firstName: String(firstName).trim(),
    lastName: String(lastName).trim(),
    email: String(email).trim().toLowerCase(),
    phone: String(phone).trim(),
    destination: body.destination ? String(body.destination).trim() : "Ischia",
    checkIn: String(checkIn),
    checkOut: String(checkOut),
    adults: Math.max(1, Number(body.adults ?? 2)),
    children,
    rooms: Math.max(1, Number(body.rooms ?? 1)),
    treatment: body.treatment ? String(body.treatment).trim() : undefined,
    message: body.message ? String(body.message).trim() : undefined,
    metadata: {
      source: "form_pubblico",
      ...(body.requestedHotel ? { requested_hotel: String(body.requestedHotel).trim() } : {}),
      ...(typeof body.metadata === "object" && body.metadata ? body.metadata : {})
    }
  });

  if (!result.data) {
    return NextResponse.json(
      { ok: false, error: result.error ?? "Invio non riuscito. Riprova o chiamaci direttamente." },
      { status: 503 }
    );
  }

  return NextResponse.json({ ok: true, data: { id: result.data.id } });
}
