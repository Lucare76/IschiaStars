import { NextResponse } from "next/server";
import { FEATURE_FLAGS_KEY } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

// Endpoint diagnostico temporaneo
export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  // Fetch HTTP diretto dalla Vercel serverless — bypassa completamente il JS client
  let directHttp: unknown = null;
  let directHttpError: string | null = null;
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/settings?key=eq.${FEATURE_FLAGS_KEY}&select=key,value`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        cache: "no-store"
      }
    );
    directHttp = await res.json();
  } catch (e) {
    directHttpError = String(e);
  }

  return NextResponse.json({
    supabaseUrlFull: supabaseUrl,
    serviceKeyPrefix: serviceKey.slice(0, 50),
    directHttpFromVercel: directHttp,
    directHttpError,
    ts: new Date().toISOString()
  });
}
