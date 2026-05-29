import { NextRequest, NextResponse } from "next/server";
import { ADMIN_ACCESS_COOKIE, ADMIN_REFRESH_COOKIE } from "@/lib/server/auth-guard";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdminPath = pathname === "/admin" || pathname.startsWith("/admin/");
  const isLoginPath = pathname === "/login";

  if (!isAdminPath && !isLoginPath) return NextResponse.next();

  const accessToken = request.cookies.get(ADMIN_ACCESS_COOKIE)?.value;
  const isAuthenticated = await hasValidAdminSession(accessToken);

  if (isAdminPath && !isAuthenticated) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    clearAuthCookies(response);
    return response;
  }

  if (isLoginPath && isAuthenticated) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  if (isLoginPath && accessToken && !isAuthenticated) {
    const response = NextResponse.next();
    clearAuthCookies(response);
    return response;
  }

  return NextResponse.next();
}

async function hasValidAdminSession(accessToken?: string) {
  if (!accessToken || !isSupabaseConfigured()) return false;

  const supabase = createSupabaseServerClient();
  if (!supabase) return false;

  const { data, error } = await supabase.auth.getUser(accessToken);
  return Boolean(!error && data.user);
}

function clearAuthCookies(response: NextResponse) {
  response.cookies.set(ADMIN_ACCESS_COOKIE, "", { maxAge: 0, path: "/" });
  response.cookies.set(ADMIN_REFRESH_COOKIE, "", { maxAge: 0, path: "/" });
}

export const config = {
  matcher: ["/admin/:path*", "/login"]
};
