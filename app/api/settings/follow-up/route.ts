import { NextRequest, NextResponse } from "next/server";
import { normalizeFollowUpSettings } from "@/lib/follow-up-settings";
import { getFollowUpSettings, updateFollowUpSettings } from "@/lib/repositories/followUpSettings";
import { requireAdminApiAccess } from "@/lib/server/auth-guard";

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdminApiAccess(request);
  if (unauthorized) return unauthorized;

  const result = await getFollowUpSettings();
  return NextResponse.json({ ok: true, source: result.source, data: result.data, error: result.error });
}

export async function PATCH(request: NextRequest) {
  const unauthorized = await requireAdminApiAccess(request);
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Payload non valido" }, { status: 400 });

  const settings = normalizeFollowUpSettings(body);
  const result = await updateFollowUpSettings(settings);

  return NextResponse.json({
    ok: Boolean(result.data),
    source: result.source,
    data: result.data,
    error: result.error
  }, { status: result.data ? 200 : 500 });
}
