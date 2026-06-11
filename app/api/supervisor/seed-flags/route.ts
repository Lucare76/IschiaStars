import { NextRequest, NextResponse } from "next/server";
import { updateFeatureFlag } from "@/lib/repositories/settings";

// Endpoint temporaneo — da rimuovere dopo l'attivazione di instant_reaction
export async function POST(request: NextRequest) {
  const key = request.headers.get("x-admin-key");
  if (!key || key !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });
  }

  const result = await updateFeatureFlag("instant_reaction", true);
  if (result.source !== "supabase") {
    return NextResponse.json({ ok: false, error: result.error ?? "Salvataggio fallito", source: result.source }, { status: 503 });
  }
  return NextResponse.json({ ok: true, data: result.data });
}
