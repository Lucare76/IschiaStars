import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const ADMIN_ACCESS_COOKIE = "ischiastars_admin_access_token";
export const ADMIN_REFRESH_COOKIE = "ischiastars_admin_refresh_token";

function validAdminKey(request: NextRequest) {
  const expectedKey = process.env.ADMIN_API_KEY;
  return Boolean(expectedKey && request.headers.get("x-admin-key") === expectedKey);
}

export async function getAdminUserFromToken(accessToken?: string) {
  if (!accessToken) return null;

  const supabase = createSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) return null;

  return data.user;
}

export async function getAdminSession() {
  const accessToken = cookies().get(ADMIN_ACCESS_COOKIE)?.value;
  const user = await getAdminUserFromToken(accessToken);
  return user ? { user } : null;
}

export async function requireAdminSession() {
  const session = await getAdminSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireAdminApiAccess(request: NextRequest) {
  if (validAdminKey(request)) return null;

  const accessToken = request.cookies.get(ADMIN_ACCESS_COOKIE)?.value;
  const user = await getAdminUserFromToken(accessToken);
  if (user) return null;

  return NextResponse.json({ ok: false, error: "Operazione non autorizzata" }, { status: 401 });
}
