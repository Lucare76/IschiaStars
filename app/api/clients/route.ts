import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/server/auth-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type ClientSearchResult = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdminApiAccess(request);
  if (unauthorized) return unauthorized;

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ ok: true, data: [] });

  const supabase = createSupabaseAdminClient();
  if (!supabase) return NextResponse.json({ ok: true, data: [] });

  const { data, error } = await supabase
    .from("quotes")
    .select("client_first_name, client_last_name, client_email, client_phone")
    .or(
      `client_first_name.ilike.%${q}%,client_last_name.ilike.%${q}%,client_email.ilike.%${q}%,client_phone.ilike.%${q}%`
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ ok: true, data: [] });

  // Deduplicazione per email
  const seen = new Set<string>();
  const clients: ClientSearchResult[] = [];
  for (const row of data ?? []) {
    const key = String(row.client_email ?? "").toLowerCase() || `${row.client_first_name}-${row.client_last_name}-${row.client_phone}`;
    if (!seen.has(key)) {
      seen.add(key);
      clients.push({
        firstName: String(row.client_first_name ?? ""),
        lastName: String(row.client_last_name ?? ""),
        email: String(row.client_email ?? ""),
        phone: String(row.client_phone ?? "")
      });
    }
  }

  return NextResponse.json({ ok: true, data: clients });
}
