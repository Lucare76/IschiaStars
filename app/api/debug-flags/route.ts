import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { FEATURE_FLAGS_KEY, normalizeFeatureFlags } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

// Endpoint diagnostico temporaneo — rimuovere dopo il debug
export async function GET() {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ step: "no_client", error: "createSupabaseAdminClient returned null" });
  }

  const { data, error } = await supabase
    .from("settings")
    .select("value")
    .eq("key", FEATURE_FLAGS_KEY)
    .maybeSingle();

  const rawValue = data?.value;
  const normalized = normalizeFeatureFlags(rawValue);

  return NextResponse.json({
    step: "done",
    supabaseError: error ? { message: error.message, code: (error as { code?: string }).code } : null,
    rawData: data,
    rawValueType: typeof rawValue,
    rawValueJson: JSON.stringify(rawValue),
    normalized,
    FEATURE_FLAGS_KEY,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 40),
    hasServiceKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  });
}
