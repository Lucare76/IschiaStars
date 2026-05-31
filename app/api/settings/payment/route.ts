import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/server/auth-guard";
import { normalizePaymentSettings, validateIbanLight } from "@/lib/payment-settings";
import { getPaymentSettings, updatePaymentSettings } from "@/lib/repositories/settings";

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdminApiAccess(request);
  if (unauthorized) return unauthorized;

  const result = await getPaymentSettings();
  return NextResponse.json({ ok: true, source: result.source, data: result.data, error: result.error });
}

export async function PATCH(request: NextRequest) {
  const unauthorized = await requireAdminApiAccess(request);
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Payload non valido" }, { status: 400 });

  const settings = normalizePaymentSettings(body);
  const ibanWarning = validateIbanLight(settings.iban);
  const result = await updatePaymentSettings(settings);

  return NextResponse.json({
    ok: Boolean(result.data),
    source: result.source,
    data: result.data,
    warning: ibanWarning,
    error: result.error
  }, { status: result.data ? 200 : 500 });
}
