import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/server/auth-guard";
import { getFollowUpRuleSettings, updateFollowUpRuleSettings } from "@/lib/repositories/followUpRuleSettings";
import { normalizeFollowUpRuleSettings } from "@/lib/follow-up-rule-settings";

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdminApiAccess(request);
  if (unauthorized) return unauthorized;
  const result = await getFollowUpRuleSettings();
  return NextResponse.json({ ok: true, data: result.data, source: result.source });
}

export async function PATCH(request: NextRequest) {
  const unauthorized = await requireAdminApiAccess(request);
  if (unauthorized) return unauthorized;
  const body = await request.json().catch(() => null);
  const result = await updateFollowUpRuleSettings(normalizeFollowUpRuleSettings(body));
  return NextResponse.json({ ok: true, data: result.data, source: result.source });
}
