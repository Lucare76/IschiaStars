import { NextRequest, NextResponse } from "next/server";
import { normalizeQuoteContentSettings } from "@/lib/quote-content-settings";
import { getQuoteContentSettings, updateQuoteContentSettings } from "@/lib/repositories/quoteContentSettings";
import { requireAdminApiAccess } from "@/lib/server/auth-guard";

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdminApiAccess(request);
  if (unauthorized) return unauthorized;
  const result = await getQuoteContentSettings();
  return NextResponse.json({ ok: true, data: result.data, source: result.source });
}

export async function PATCH(request: NextRequest) {
  const unauthorized = await requireAdminApiAccess(request);
  if (unauthorized) return unauthorized;
  const body = await request.json().catch(() => null);
  const result = await updateQuoteContentSettings(normalizeQuoteContentSettings(body));
  return NextResponse.json({ ok: true, data: result.data, source: result.source });
}
