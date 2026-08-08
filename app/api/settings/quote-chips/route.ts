import { NextRequest, NextResponse } from "next/server";
import { normalizeQuoteChipSettings } from "@/lib/quote-chip-settings";
import { getQuoteChipSettings, updateQuoteChipSettings } from "@/lib/repositories/settings";
import { requireAdminApiAccess } from "@/lib/server/auth-guard";

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdminApiAccess(request);
  if (unauthorized) return unauthorized;

  const result = await getQuoteChipSettings();
  return NextResponse.json({ ok: true, source: result.source, data: result.data, error: result.error });
}

export async function PATCH(request: NextRequest) {
  const unauthorized = await requireAdminApiAccess(request);
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Payload non valido" }, { status: 400 });

  const settings = normalizeQuoteChipSettings(body);
  const result = await updateQuoteChipSettings(settings);

  return NextResponse.json({
    ok: Boolean(result.data),
    source: result.source,
    data: result.data,
    error: result.error
  }, { status: result.data ? 200 : 500 });
}
