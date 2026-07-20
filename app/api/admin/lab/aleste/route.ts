import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/server/auth-guard";
import { isAlestePublicTestEnabled, runAlestePublicTest, type AlestePublicTestInput } from "@/lib/integrations/aleste-public";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Operazione non autorizzata" }, { status: 401 });
  }
  if (session.role !== "supervisor") {
    return NextResponse.json({ ok: false, error: "Accesso Lab non autorizzato" }, { status: 403 });
  }

  if (!isAlestePublicTestEnabled()) {
    return NextResponse.json({ ok: false, error: "Test Aleste non abilitato" }, { status: 404 });
  }

  const payload = await request.json().catch(() => null) as Partial<AlestePublicTestInput> | null;
  const validation = validatePayload(payload);
  if (!validation.ok) {
    return NextResponse.json({ ok: false, error: validation.error }, { status: 400 });
  }

  const result = await runAlestePublicTest(validation.input);
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}

function validatePayload(payload: Partial<AlestePublicTestInput> | null):
  | { ok: true; input: AlestePublicTestInput }
  | { ok: false; error: string } {
  if (!payload) return { ok: false, error: "Payload non valido" };

  const destination = typeof payload.destination === "string" ? payload.destination.trim() : "";
  const checkIn = typeof payload.checkIn === "string" ? payload.checkIn : "";
  const checkOut = typeof payload.checkOut === "string" ? payload.checkOut : "";
  const adults = Number(payload.adults);
  const rooms = Number(payload.rooms ?? 1);
  const childrenAges = Array.isArray(payload.childrenAges)
    ? payload.childrenAges.map((age) => Number(age)).filter((age) => Number.isFinite(age))
    : [];

  if (!destination) return { ok: false, error: "Destinazione obbligatoria" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkIn) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOut)) {
    return { ok: false, error: "Date non valide" };
  }
  if (new Date(checkOut).getTime() <= new Date(checkIn).getTime()) {
    return { ok: false, error: "Il check-out deve essere successivo al check-in" };
  }
  if (!Number.isFinite(adults) || adults < 1 || adults > 6) {
    return { ok: false, error: "Numero adulti non valido" };
  }
  if (!Number.isFinite(rooms) || rooms < 1 || rooms > 3) {
    return { ok: false, error: "Numero camere non valido" };
  }
  if (childrenAges.some((age) => age < 0 || age > 17)) {
    return { ok: false, error: "Età bambini non valide" };
  }

  return {
    ok: true,
    input: {
      destination,
      checkIn,
      checkOut,
      adults,
      rooms,
      childrenAges
    }
  };
}
