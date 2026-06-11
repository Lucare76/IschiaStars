import { NextResponse } from "next/server";
import { getFeatureFlags } from "@/lib/repositories/settings";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { FEATURE_FLAGS_KEY } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

// Endpoint diagnostico temporaneo
export async function GET() {
  // Query identica a getFeatureFlags()
  const result = await getFeatureFlags();

  // Query diretta per confronto
  const supabase = createSupabaseAdminClient();
  let directRaw: unknown = "no client";
  if (supabase) {
    const { data } = await supabase
      .from("settings")
      .select("key,value")
      .eq("key", FEATURE_FLAGS_KEY)
      .maybeSingle();
    directRaw = data;
  }

  return NextResponse.json({
    getFeatureFlags: { source: result.source, data: result.data, error: result.error ?? null },
    directQuery: directRaw,
    ts: new Date().toISOString()
  });
}
