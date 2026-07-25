import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { createQuoteRequest } from "@/lib/repositories/quoteRequests";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const RATE_LIMIT_ROUTE = "/api/richiesta";
const RATE_LIMIT_MAX_REQUESTS = 3;
const RATE_LIMIT_WINDOW_MINUTES = 15;
const RATE_LIMIT_ERROR = "Hai inviato troppe richieste in poco tempo. Riprova tra qualche minuto.";

export async function POST(request: NextRequest) {
  const rateLimit = await checkRateLimit(request);
  if (!rateLimit.allowed) {
    return NextResponse.json({ success: false, error: RATE_LIMIT_ERROR }, { status: 429 });
  }

  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "Richiesta non valida" }, { status: 400 });
  }

  const { firstName, lastName, email, phone, checkIn, checkOut } = body;
  if (!firstName || !lastName || (!email && !phone) || !checkIn || !checkOut) {
    return NextResponse.json({ ok: false, error: "Compila tutti i campi obbligatori (almeno email o telefono)" }, { status: 400 });
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
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

function clientIpFromRequest(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const firstForwardedIp = forwardedFor?.split(",")[0]?.trim();
  if (firstForwardedIp) return firstForwardedIp;

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  return "unknown";
}

function hashIp(ip: string, secret: string) {
  return createHash("sha256").update(`${ip}${secret}`).digest("hex");
}

async function checkRateLimit(request: NextRequest): Promise<{ allowed: boolean }> {
  const secret = process.env.RATE_LIMIT_SECRET;
  if (!secret) {
    console.warn("[rate-limit] skipped route=/api/richiesta reason=missing_secret");
    return { allowed: true };
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    console.warn("[rate-limit] skipped route=/api/richiesta reason=supabase_not_configured");
    return { allowed: true };
  }

  try {
    const ipHash = hashIp(clientIpFromRequest(request), secret);
    const { data, error } = await supabase
      .rpc("check_request_rate_limit", {
        p_route: RATE_LIMIT_ROUTE,
        p_ip_hash: ipHash,
        p_limit: RATE_LIMIT_MAX_REQUESTS,
        p_window_minutes: RATE_LIMIT_WINDOW_MINUTES
      })
      .maybeSingle();

    if (error) {
      console.warn("[rate-limit] fail-open route=/api/richiesta reason=rpc_error");
      return { allowed: true };
    }

    const row = data as { allowed?: boolean } | null;
    return { allowed: row?.allowed !== false };
  } catch {
    console.warn("[rate-limit] fail-open route=/api/richiesta reason=unexpected_error");
    return { allowed: true };
  }
}
