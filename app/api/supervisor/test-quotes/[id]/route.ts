import { NextResponse } from "next/server";
import { softDeleteQuote } from "@/lib/repositories/quotes";
import { getAdminSession } from "@/lib/server/auth-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session || session.role !== "supervisor") {
    return NextResponse.json({ ok: false, error: "Accesso non autorizzato" }, { status: 403 });
  }

  const isLabTest = await quoteIsLabTest(params.id);
  if (!isLabTest) {
    return NextResponse.json({ ok: false, error: "Preventivo non trovato" }, { status: 404 });
  }

  const result = await softDeleteQuote(params.id, "Eliminato dal Pannello Supervisor");
  if (!result.data) {
    return NextResponse.json({ ok: false, error: result.error ?? "Eliminazione non riuscita" }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}

async function quoteIsLabTest(quoteId: string) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return false;

  const { data } = await supabase
    .from("quotes")
    .select("id")
    .eq("id", quoteId)
    .eq("metadata->>is_lab_test", "true")
    .maybeSingle();

  return Boolean(data);
}
