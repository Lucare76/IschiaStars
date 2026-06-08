import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/server/auth-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function PATCH(request: NextRequest) {
  const session = await getAdminSession();
  if (!session || session.role !== "supervisor") {
    return NextResponse.json({ ok: false, error: "Accesso non autorizzato" }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as { quoteId?: string } | null;
  const quoteId = body?.quoteId;
  if (typeof quoteId !== "string" || !quoteId) {
    return NextResponse.json({ ok: false, error: "quoteId mancante" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase non configurato" }, { status: 503 });
  }

  const { data: existing } = await supabase.from("quotes").select("metadata").eq("id", quoteId).maybeSingle();
  const metadata = { ...(existing?.metadata as Record<string, unknown> | null ?? {}), is_lab_test: true };

  const { error } = await supabase
    .from("quotes")
    .update({ metadata, excluded_from_stats: true, updated_at: new Date().toISOString() })
    .eq("id", quoteId);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 503 });
  }

  return NextResponse.json({ success: true });
}
