import { NextResponse } from "next/server";
import { getFeatureFlags } from "@/lib/repositories/settings";

export const dynamic = "force-dynamic";

// Endpoint diagnostico temporaneo — rimuovere dopo il debug
export async function GET() {
  const result = await getFeatureFlags();
  return NextResponse.json({ source: result.source, data: result.data, error: result.error ?? null });
}
