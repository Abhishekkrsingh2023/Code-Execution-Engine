import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isTokenExpiringSoon, parseSetCookieHeader } from "@/lib/auth/cookies";

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const baseUrl = process.env.API_BASE_URL || "http://localhost:8000";

  let accessToken = request.cookies.get("access_token")?.value;
  const refreshToken = request.cookies.get("refresh_token")?.value;

  const response = NextResponse.next();
  let isAuthenticated = Boolean(accessToken && !isTokenExpiringSoon(accessToken, 0));

  // If access token is missing or expiring within 30s, attempt refresh
  if ((!accessToken || isTokenExpiringSoon(accessToken, 30)) && refreshToken) {
    try {
      const refreshRes = await fetch(`${baseUrl}/api-v1/users/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `refresh_token=${refreshToken}`,
        },
      });

      if (refreshRes.ok) {
        isAuthenticated = true;
        const setCookies = refreshRes.headers.getSetCookie();
        for (const sc of setCookies) {
          const parsed = parseSetCookieHeader(sc);
          if (parsed) {
            response.cookies.set(parsed.name, parsed.value, {
              httpOnly: parsed.httpOnly,
              secure: parsed.secure,
              sameSite: parsed.sameSite,
              path: parsed.path,
              maxAge: parsed.maxAge,
            });
            if (parsed.name === "access_token") {
              accessToken = parsed.value;
              request.cookies.set(parsed.name, parsed.value);
            }
          }
        }
      } else {
        response.cookies.delete("access_token");
        response.cookies.delete("refresh_token");
        isAuthenticated = false;
      }
    } catch {
      // Network or internal error during refresh
    }
  }

  const isGuestOnlyRoute =
    pathname === "/login" || pathname === "/register" || pathname === "/verify";
  const isProtectedUserRoute = pathname.startsWith("/profile");

  if (isAuthenticated && isGuestOnlyRoute) {
    const nextUrl = request.nextUrl.searchParams.get("next") || "/problems";
    return NextResponse.redirect(new URL(nextUrl, request.url));
  }

  if (!isAuthenticated && isProtectedUserRoute) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|Code0.png|hero-image.png|languages/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
