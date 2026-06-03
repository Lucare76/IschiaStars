import { NextRequest, NextResponse } from "next/server";

const ADMIN_ACCESS_COOKIE = "ischiastars_admin_access_token";
const ADMIN_REFRESH_COOKIE = "ischiastars_admin_refresh_token";

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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!accessToken || !supabaseUrl || !anonKey) return false;

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`
      }
    });
    return response.ok;
  } catch {
    return false;
  }
}

function clearAuthCookies(response: NextResponse) {
  response.cookies.set(ADMIN_ACCESS_COOKIE, "", { maxAge: 0, path: "/" });
  response.cookies.set(ADMIN_REFRESH_COOKIE, "", { maxAge: 0, path: "/" });
}

export const config = {
  matcher: ["/admin/:path*", "/login"]
};
