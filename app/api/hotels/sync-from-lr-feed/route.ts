import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/server/auth-guard";
import { syncLrHotelFeed } from "@/lib/repositories/hotels";
import { isSupabaseAdminConfigured } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminApiAccess(request);
  if (unauthorized) return unauthorized;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json(
      { ok: false, error: "La sincronizzazione richiede il collegamento al database operativo." },
      { status: 503 }
    );
  }

  const result = await syncLrHotelFeed();

  if (!result.data || result.error) {
    return NextResponse.json(
      { ok: false, source: result.source, error: result.error ?? "Sincronizzazione non riuscita" },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    source: result.source,
    data: result.data,
  });
}
