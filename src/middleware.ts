import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig, SESSION_COOKIE_NAME } from "@/lib/auth/auth.config";

const { auth } = NextAuth(authConfig);

function clearLegacyCookies(res: NextResponse) {
  res.cookies.delete("authjs.session-token");
  res.cookies.delete("__Secure-authjs.session-token");
  res.cookies.delete("next-auth.session-token");
  return res;
}

export default auth((req) => {
  const isLoggedIn = !!(req.auth?.user?.id || req.auth?.user?.email);
  const { pathname, searchParams } = req.nextUrl;
  const isReauth = searchParams.get("reauth") === "1";

  const isAuthPage =
    pathname.startsWith("/login") || pathname.startsWith("/register");
  const isApiRoute = pathname.startsWith("/api");

  if (isApiRoute) {
    return clearLegacyCookies(NextResponse.next());
  }

  if (pathname === "/") {
    return clearLegacyCookies(
      NextResponse.redirect(
        new URL(isLoggedIn ? "/dashboard" : "/login", req.nextUrl)
      )
    );
  }

  if (isAuthPage) {
    if (isReauth) {
      const res = NextResponse.next();
      res.cookies.delete(SESSION_COOKIE_NAME);
      return clearLegacyCookies(res);
    }
    if (isLoggedIn) {
      return clearLegacyCookies(
        NextResponse.redirect(new URL("/dashboard", req.nextUrl))
      );
    }
    return clearLegacyCookies(NextResponse.next());
  }

  if (!isLoggedIn) {
    return clearLegacyCookies(
      NextResponse.redirect(new URL("/login", req.nextUrl))
    );
  }

  return clearLegacyCookies(NextResponse.next());
});

export const config = {
  matcher: [
    "/((?!api/auth|api/mock-login|api/time|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
