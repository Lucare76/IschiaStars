import { NextRequest, NextResponse } from "next/server";
import { getQuoteNotifications, markQuoteNotificationsSeen } from "@/lib/repositories/quoteNotifications";
import { requireAdminApiAccess } from "@/lib/server/auth-guard";

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdminApiAccess(request);
  if (unauthorized) return unauthorized;

  const result = await getQuoteNotifications(20);
  return NextResponse.json({
    ok: result.source === "supabase",
    source: result.source,
    data: result.data,
    error: result.error
  }, { status: result.source === "supabase" ? 200 : 503 });
}

export async function PATCH(request: NextRequest) {
  const unauthorized = await requireAdminApiAccess(request);
  if (unauthorized) return unauthorized;

  const result = await markQuoteNotificationsSeen();
  return NextResponse.json({
    ok: result.source === "supabase",
    source: result.source,
    seenAt: result.data,
    error: result.error
  }, { status: result.source === "supabase" ? 200 : 503 });
}
