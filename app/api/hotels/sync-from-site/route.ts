import { NextRequest, NextResponse } from "next/server";
import { syncImportedHotels } from "@/lib/repositories/hotels";
import { fetchIschiaStarsHotels } from "@/lib/server/ischiastars-hotel-importer";
import { requireAdminApiAccess } from "@/lib/server/auth-guard";
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

  try {
    const importedHotels = await fetchIschiaStarsHotels();
    if (!importedHotels.length) {
      return NextResponse.json(
        { ok: false, error: "Nessuna struttura rilevata sul sito IschiaStars.", data: { imported: 0, updated: 0, alreadyPresent: 0, notDetected: 0, errors: [] } },
        { status: 502 }
      );
    }

    const result = await syncImportedHotels(importedHotels);
    return NextResponse.json(
      { ok: !result.error, source: result.source, data: result.data, error: result.error },
      { status: result.error ? 503 : 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Sincronizzazione non riuscita" },
      { status: 502 }
    );
  }
}
