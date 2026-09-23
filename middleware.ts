import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

const ADMIN_ACCESS_COOKIE = "ischiastars_admin_access_token";
const ADMIN_REFRESH_COOKIE = "ischiastars_admin_refresh_token";
const REFRESH_THRESHOLD_SECONDS = 5 * 60;
const REFRESH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
const secureCookie = process.env.NODE_ENV === "production";

function tokenNeedsRefresh(accessToken?: string) {
  if (!accessToken) return true;

  try {
    const [, payload] = accessToken.split(".");
    if (!payload) return true;

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const parsed = JSON.parse(atob(padded)) as { exp?: number };

    if (!parsed.exp) return true;

    const nowInSeconds = Math.floor(Date.now() / 1000);
    return parsed.exp - nowInSeconds <= REFRESH_THRESHOLD_SECONDS;
  } catch {
    return true;
  }
}

function clearAuthCookies(response: NextResponse) {
  response.cookies.set(ADMIN_ACCESS_COOKIE, "", { maxAge: 0, path: "/" });
  response.cookies.set(ADMIN_REFRESH_COOKIE, "", { maxAge: 0, path: "/" });
}

export async function middleware(request: NextRequest) {
  const accessToken = request.cookies.get(ADMIN_ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(ADMIN_REFRESH_COOKIE)?.value;

  if (!refreshToken || !tokenNeedsRefresh(accessToken) || !isSupabaseConfigured()) {
    return NextResponse.next();
  }

  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.next();

  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: refreshToken
  });

  if (error || !data.session) {
    const response = NextResponse.next();
    clearAuthCookies(response);
    return response;
  }

  const requestHeaders = new Headers(request.headers);
  const requestCookies = request.cookies;

  requestCookies.set(ADMIN_ACCESS_COOKIE, data.session.access_token);
  requestCookies.set(ADMIN_REFRESH_COOKIE, data.session.refresh_token);
  requestHeaders.set("cookie", requestCookies.toString());

  const response = NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });

  response.cookies.set(ADMIN_ACCESS_COOKIE, data.session.access_token, {
    httpOnly: true,
    maxAge: data.session.expires_in,
    path: "/",
    sameSite: "lax",
    secure: secureCookie
  });
  response.cookies.set(ADMIN_REFRESH_COOKIE, data.session.refresh_token, {
    httpOnly: true,
    maxAge: REFRESH_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: secureCookie
  });

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/api/:path*"]
};
