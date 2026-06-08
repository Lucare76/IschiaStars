import { NextRequest, NextResponse } from "next/server";
import { getActiveHotels } from "@/lib/repositories/hotels";
import { createQuoteFromRequest, excludeQuoteFromStats, listLabTestQuotes } from "@/lib/repositories/quotes";
import { getAdminSession } from "@/lib/server/auth-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const TEST_CLIENT_PHONE_PLACEHOLDER = "0000000000";

export async function GET() {
  const session = await getAdminSession();
  if (!session || session.role !== "supervisor") {
    return NextResponse.json({ ok: false, error: "Accesso non autorizzato" }, { status: 403 });
  }

  const testQuotes = await listLabTestQuotes();
  return NextResponse.json({ ok: true, data: testQuotes });
}

export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!session || session.role !== "supervisor") {
    return NextResponse.json({ ok: false, error: "Accesso non autorizzato" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const clientFirstName = stringOrDefault(body?.clientFirstName, "Test Supervisor");
  const checkIn = body?.checkIn;
  const checkOut = body?.checkOut;
  const adults = Number(body?.adults ?? 2);
  const hotelId = body?.hotelId;
  const treatment = body?.treatment;
  const price = Number(body?.price);

  if (typeof checkIn !== "string" || !checkIn || typeof checkOut !== "string" || !checkOut) {
    return NextResponse.json({ ok: false, error: "Date check-in/check-out mancanti" }, { status: 400 });
  }
  if (typeof hotelId !== "string" || !hotelId) {
    return NextResponse.json({ ok: false, error: "Seleziona un hotel" }, { status: 400 });
  }
  if (treatment !== "BB" && treatment !== "HB" && treatment !== "FB") {
    return NextResponse.json({ ok: false, error: "Trattamento non valido" }, { status: 400 });
  }
  if (!Number.isFinite(price) || price <= 0) {
    return NextResponse.json({ ok: false, error: "Inserisci un prezzo valido" }, { status: 400 });
  }

  const hotelsResult = await getActiveHotels();
  const hotel = hotelsResult.data.find((h) => h.id === hotelId);
  if (!hotel) {
    return NextResponse.json({ ok: false, error: "Hotel non trovato" }, { status: 400 });
  }

  const result = await createQuoteFromRequest({
    status: "in_lavorazione",
    clientFirstName,
    clientPhone: TEST_CLIENT_PHONE_PLACEHOLDER,
    checkIn,
    checkOut,
    adults: Number.isFinite(adults) && adults > 0 ? adults : 2,
    rooms: 1,
    treatment,
    totalPrice: price,
    depositAmount: 0,
    internalNotes: "Preventivo di test creato dal Pannello Supervisor.",
    hotelId,
    hotelOptions: [{
      hotelId,
      position: 1,
      hotelName: hotel.name,
      breakfastPrice: treatment === "BB" ? price : undefined,
      halfBoardPrice: treatment === "HB" ? price : undefined,
      fullBoardPrice: treatment === "FB" ? price : undefined
    }]
  }, { isLabTest: true });

  if (!result.data) {
    return NextResponse.json({ ok: false, error: result.error ?? "Creazione non riuscita" }, { status: 503 });
  }

  const quote = result.data;
  await markAsLabTest(quote.id);
  await excludeQuoteFromStats(quote.id, true);

  return NextResponse.json({
    ok: true,
    data: {
      id: quote.id,
      code: quote.code,
      clientName: [quote.customerFirstName, quote.customerLastName].filter(Boolean).join(" ").trim(),
      createdAt: quote.createdAt,
      publicUrl: `/preventivi/${quote.code}?token=${quote.token}`
    }
  });
}

async function markAsLabTest(quoteId: string) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return;
  await supabase
    .from("quotes")
    .update({ metadata: { is_lab_test: true }, updated_at: new Date().toISOString() })
    .eq("id", quoteId);
}

function stringOrDefault(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}
