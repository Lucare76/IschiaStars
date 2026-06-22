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
  const db = supabase;

  const clientsResult = await db
    .from("clients")
    .select("first_name, last_name, email, phone")
    .or(
      `first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`
    )
    .order("last_seen_at", { ascending: false })
    .limit(50);

  const rows = clientsResult.error
    ? await loadLegacyClientRows(q)
    : (clientsResult.data ?? []).map((row) => ({
        firstName: String(row.first_name ?? ""),
        lastName: String(row.last_name ?? ""),
        email: String(row.email ?? ""),
        phone: String(row.phone ?? "")
      }));

  // Deduplicazione per email, con telefono come alternativa.
  const seen = new Set<string>();
  const clients: ClientSearchResult[] = [];
  for (const row of rows) {
    const key = row.email.toLowerCase() || `${row.firstName}-${row.lastName}-${row.phone}`;
    if (!seen.has(key)) {
      seen.add(key);
      clients.push(row);
    }
  }

  return NextResponse.json({ ok: true, data: clients });

  async function loadLegacyClientRows(search: string): Promise<ClientSearchResult[]> {
    const { data } = await db
      .from("quotes")
      .select("client_first_name, client_last_name, client_email, client_phone")
      .or(
        `client_first_name.ilike.%${search}%,client_last_name.ilike.%${search}%,client_email.ilike.%${search}%,client_phone.ilike.%${search}%`
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(50);

    return (data ?? []).map((row) => ({
      firstName: String(row.client_first_name ?? ""),
      lastName: String(row.client_last_name ?? ""),
      email: String(row.client_email ?? ""),
      phone: String(row.client_phone ?? "")
    }));
  }
}
