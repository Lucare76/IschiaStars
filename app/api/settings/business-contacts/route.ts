import { NextRequest, NextResponse } from "next/server";
import { normalizeBusinessContactSettings } from "@/lib/business-contact-settings";
import { getBusinessContactSettings, updateBusinessContactSettings } from "@/lib/repositories/businessContactSettings";
import { requireAdminApiAccess } from "@/lib/server/auth-guard";

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdminApiAccess(request);
  if (unauthorized) return unauthorized;
  const result = await getBusinessContactSettings();
  return NextResponse.json({ ok: true, data: result.data, source: result.source });
}

export async function PATCH(request: NextRequest) {
  const unauthorized = await requireAdminApiAccess(request);
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => null);
  const settings = normalizeBusinessContactSettings(body);
  const result = await updateBusinessContactSettings(settings);
  return NextResponse.json({ ok: true, data: result.data, source: result.source });
}
