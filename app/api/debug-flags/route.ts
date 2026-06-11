import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { FEATURE_FLAGS_KEY } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

// Endpoint diagnostico temporaneo — rimuovere dopo il debug
export async function GET() {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return NextResponse.json({ step: "no_client" });

  // Stessa query identica a getFeatureFlags()
  const { data, error } = await supabase
    .from("settings")
    .select("value")
    .eq("key", FEATURE_FLAGS_KEY)
    .maybeSingle();

  return NextResponse.json({
    step: "done",
    error: error ? { message: error.message, code: (error as { code?: string }).code } : null,
    rawData: data,
    rawDataType: typeof data,
    rawValueStringified: JSON.stringify(data),
    instantReactionRaw: data != null ? (data as Record<string, unknown>).value : "DATA_IS_NULL",
    FEATURE_FLAGS_KEY,
    ts: Date.now()
  });
}
