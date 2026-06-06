import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const ADMIN_ACCESS_COOKIE = "ischiastars_admin_access_token";
export const ADMIN_REFRESH_COOKIE = "ischiastars_admin_refresh_token";

const AUTHORIZED_EMAILS = {
  "info@ischiastars.it": "admin",
  "luca_renna@hotmail.com": "supervisor"
} as const;

export type UserRole = "admin" | "supervisor";
export type AdminSession = { user: User; role: UserRole };

function validAdminKey(request: NextRequest) {
  const expectedKey = process.env.ADMIN_API_KEY;
  return Boolean(expectedKey && request.headers.get("x-admin-key") === expectedKey);
}

export async function getAdminUserFromToken(accessToken?: string) {
  const result = await getAuthorizedUserFromToken(accessToken);
  return result.status === "authorized" ? result.user : null;
}

async function getAuthorizedUserFromToken(accessToken?: string): Promise<
  | { status: "authorized"; user: User; role: UserRole }
  | { status: "unauthorized_email" }
  | { status: "invalid" }
> {
  if (!accessToken) return { status: "invalid" };

  const supabase = createSupabaseServerClient();
  if (!supabase) return { status: "invalid" };

  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) return { status: "invalid" };

  const email = data.user.email?.trim().toLowerCase();
  const role = email ? AUTHORIZED_EMAILS[email as keyof typeof AUTHORIZED_EMAILS] : undefined;
  if (!email || !role) {
    console.warn(`Accesso negato per email non autorizzata: ${email ?? "email_assente"}`);
    return { status: "unauthorized_email" };
  }

  return { status: "authorized", user: data.user, role };
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const accessToken = cookies().get(ADMIN_ACCESS_COOKIE)?.value;
  const result = await getAuthorizedUserFromToken(accessToken);
  return result.status === "authorized" ? { user: result.user, role: result.role } : null;
}

export async function requireAdminSession(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireAdminApiAccess(request: NextRequest) {
  if (validAdminKey(request)) return null;

  const accessToken = request.cookies.get(ADMIN_ACCESS_COOKIE)?.value;
  const result = await getAuthorizedUserFromToken(accessToken);
  if (result.status === "authorized") return null;
  if (result.status === "unauthorized_email") {
    return NextResponse.json({ ok: false, error: "Accesso non autorizzato" }, { status: 403 });
  }

  return NextResponse.json({ ok: false, error: "Operazione non autorizzata" }, { status: 401 });
}
