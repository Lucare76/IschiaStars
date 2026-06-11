import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { FEATURE_FLAGS_KEY } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

// Endpoint diagnostico temporaneo — rimuovere dopo il debug
export async function GET() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ step: "no_client" });
  }

  // Test 1: query con filtro
  const { data: withFilter, error: e1 } = await supabase
    .from("settings")
    .select("key,value")
    .eq("key", FEATURE_FLAGS_KEY)
    .maybeSingle();

  // Test 2: query SENZA filtro — conta righe visibili
  const { data: allRows, error: e2 } = await supabase
    .from("settings")
    .select("key");

  // Test 3: fetch HTTP diretto alla REST API (bypassa JS client)
  let directResult: unknown = null;
  let directError: string | null = null;
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/settings?key=eq.${FEATURE_FLAGS_KEY}&select=key,value`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json"
        }
      }
    );
    directResult = await res.json();
  } catch (err) {
    directError = String(err);
  }

  return NextResponse.json({
    withFilter: { data: withFilter, error: e1?.message ?? null },
    allRows: { data: allRows, rowCount: Array.isArray(allRows) ? allRows.length : null, error: e2?.message ?? null },
    directRestApi: { data: directResult, error: directError },
    serviceKeyPrefix: serviceKey.slice(0, 30),
    serviceKeySuffix: serviceKey.slice(-10),
    supabaseUrl: supabaseUrl.slice(0, 50),
    FEATURE_FLAGS_KEY
  });
}
