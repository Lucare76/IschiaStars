import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/server/auth-guard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdminApiAccess(request);
  if (unauthorized) return unauthorized;

  const apiKey = process.env.BREVO_API_KEY;
  const enabled = process.env.BREVO_ENABLED === "true";
  const fromEmail = process.env.BREVO_FROM_EMAIL ?? null;
  const fromName = process.env.BREVO_FROM_NAME ?? null;

  if (!apiKey) {
    return NextResponse.json({
      ok: false,
      enabled,
      fromEmail,
      fromName,
      error: "BREVO_API_KEY non configurata"
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const response = await fetch("https://api.brevo.com/v3/account", {
      method: "GET",
      headers: {
        "api-key": apiKey,
        accept: "application/json"
      },
      cache: "no-store"
    });

    const payload = await response.json().catch(() => null) as Record<string, unknown> | null;

    if (!response.ok) {
      return NextResponse.json({
        ok: false,
        enabled,
        fromEmail,
        fromName,
        brevoStatus: response.status,
        error: typeof payload?.message === "string" ? payload.message : "Brevo account lookup failed"
      }, { status: 502, headers: { "Cache-Control": "no-store" } });
    }

    return NextResponse.json({
      ok: true,
      enabled,
      fromEmail,
      fromName,
      account: {
        email: typeof payload?.email === "string" ? payload.email : null,
        firstName: typeof payload?.firstName === "string" ? payload.firstName : null,
        lastName: typeof payload?.lastName === "string" ? payload.lastName : null,
        companyName: typeof payload?.companyName === "string" ? payload.companyName : null
      }
    }, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      enabled,
      fromEmail,
      fromName,
      error: error instanceof Error ? error.message : "Errore diagnostica Brevo"
    }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
