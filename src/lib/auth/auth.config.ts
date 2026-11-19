import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const pathname = nextUrl.pathname;

      const isAuthPage =
        pathname.startsWith("/login") || pathname.startsWith("/register");
      const isApiAuthRoute = pathname.startsWith("/api/auth");
      const isPublicAsset =
        pathname.startsWith("/_next") ||
        pathname.startsWith("/favicon.ico") ||
        pathname.startsWith("/public");

      if (isApiAuthRoute || isPublicAsset) {
        return true;
      }

      if (isAuthPage) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/dashboard", nextUrl));
        }
        return true;
      }

      if (!isLoggedIn) {
        return false;
      }

      return true;
    },
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: Role }).role;
        token.designation = (user as { designation?: string | null }).designation ?? null;
        token.avatarUrl = (user as { avatarUrl?: string | null }).avatarUrl ?? null;
        token.departmentId = (user as { departmentId?: string | null }).departmentId ?? null;
      }
      if (trigger === "update" && session) {
        if (session.name) token.name = session.name;
        if (session.avatarUrl !== undefined) token.avatarUrl = session.avatarUrl;
        if (session.designation !== undefined) token.designation = session.designation;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        session.user.designation = (token.designation as string | null) ?? null;
        session.user.avatarUrl = (token.avatarUrl as string | null) ?? null;
        session.user.departmentId = (token.departmentId as string | null) ?? null;
      }
      return session;
    },
  },
  providers: [],
};
