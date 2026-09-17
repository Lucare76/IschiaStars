import { NextRequest, NextResponse } from "next/server";
import { getFollowUpSettingsHistory, restoreFollowUpSettingsVersion } from "@/lib/repositories/followUpSettings";
import { requireAdminApiAccess } from "@/lib/server/auth-guard";

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdminApiAccess(request);
  if (unauthorized) return unauthorized;

  const result = await getFollowUpSettingsHistory();
  return NextResponse.json({ ok: true, source: result.source, data: result.data, error: result.error });
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminApiAccess(request);
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => null) as { id?: string } | null;
  const id = body?.id?.trim();
  if (!id) return NextResponse.json({ ok: false, error: "Versione non valida" }, { status: 400 });

  const result = await restoreFollowUpSettingsVersion(id);
  if (!result.data) return NextResponse.json({ ok: false, error: "Versione non trovata" }, { status: 404 });

  return NextResponse.json({ ok: true, source: result.source, data: result.data, error: result.error });
}
