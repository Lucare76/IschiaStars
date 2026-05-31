import { NextResponse } from "next/server";
import { ADMIN_ACCESS_COOKIE, ADMIN_REFRESH_COOKIE } from "@/lib/server/auth-guard";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

const secureCookie = process.env.NODE_ENV === "production";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "Accesso non disponibile." }, { status: 503 });
  }

  const refreshToken = readCookie(request.headers.get("cookie") ?? "", ADMIN_REFRESH_COOKIE);
  if (!refreshToken) {
    return NextResponse.json({ ok: false, error: "Sessione scaduta. Effettua di nuovo il login." }, { status: 401 });
  }

  const supabase = createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Accesso non disponibile." }, { status: 503 });
  }

  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session) {
    const response = NextResponse.json({ ok: false, error: "Sessione scaduta. Effettua di nuovo il login." }, { status: 401 });
    clearAuthCookies(response);
    return response;
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_ACCESS_COOKIE, data.session.access_token, {
    httpOnly: true,
    maxAge: data.session.expires_in,
    path: "/",
    sameSite: "lax",
    secure: secureCookie
  });
  response.cookies.set(ADMIN_REFRESH_COOKIE, data.session.refresh_token, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
    sameSite: "lax",
    secure: secureCookie
  });

  return response;
}

function clearAuthCookies(response: NextResponse) {
  response.cookies.set(ADMIN_ACCESS_COOKIE, "", { maxAge: 0, path: "/" });
  response.cookies.set(ADMIN_REFRESH_COOKIE, "", { maxAge: 0, path: "/" });
}

function readCookie(cookieHeader: string, name: string) {
  const match = cookieHeader.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
}
