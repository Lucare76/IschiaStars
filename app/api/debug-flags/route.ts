import { unstable_noStore as noStore } from "next/cache";
import { NextResponse } from "next/server";
import { getFeatureFlags } from "@/lib/repositories/settings";

export const dynamic = "force-dynamic";

// Endpoint diagnostico temporaneo
export async function GET() {
  noStore();
  const result = await getFeatureFlags();
  return NextResponse.json({
    source: result.source,
    data: result.data,
    ts: new Date().toISOString()
  });
}
