import { NextRequest, NextResponse } from "next/server";
import { isFeatureFlagKey } from "@/lib/feature-flags";
import { getFeatureFlags, updateFeatureFlag } from "@/lib/repositories/settings";
import { getAdminSession } from "@/lib/server/auth-guard";

export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!session || session.role !== "supervisor") {
    return NextResponse.json({ ok: false, error: "Accesso non autorizzato" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const flag = body?.flag;
  const value = body?.value;
  if (!isFeatureFlagKey(flag) || typeof value !== "boolean") {
    return NextResponse.json({ ok: false, error: "Dati non validi" }, { status: 400 });
  }

  const result = await updateFeatureFlag(flag, value);
  if (!result.data) {
    return NextResponse.json({ ok: false, error: result.error ?? "Salvataggio non riuscito" }, { status: 503 });
  }

  return NextResponse.json({ ok: true, data: result.data });
}

export async function GET() {
  const session = await getAdminSession();
  if (!session || session.role !== "supervisor") {
    return NextResponse.json({ ok: false, error: "Accesso non autorizzato" }, { status: 403 });
  }

  const result = await getFeatureFlags();
  return NextResponse.json({ ok: true, data: result.data });
}
