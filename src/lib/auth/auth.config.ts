import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import type { Role, UserStatus } from "@prisma/client";

export const AUTH_SECRET_KEY =
  process.env.AUTH_SECRET ||
  "meridian-work-management-jwt-secret-key-2026-secure";

export const SESSION_COOKIE_NAME = "meridian.session-token";
export const SUPER_ADMIN_EMAIL = "dishantgiri@fishtailinfosolutions.com";

export const authConfig: NextAuthConfig = {
  secret: AUTH_SECRET_KEY,
  trustHost: true,
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  cookies: {
    sessionToken: {
      name: SESSION_COOKIE_NAME,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: false,
      },
    },
  },
  providers: [
    Google({
      clientId: process.env.CLIENT_ID || process.env.GOOGLE_CLIENT_ID || "",
      clientSecret:
        process.env.CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || "",
      authorization: {
        params: {
          prompt: "select_account",
        },
      },
    }),
  ],
  callbacks: {
    jwt({ token, user, trigger, session }) {
      if (user) {
        if (user.id) token.id = user.id;
        if (user.email) token.email = user.email.toLowerCase().trim();
        if (user.name) token.name = user.name;
        if ((user as { role?: Role }).role) {
          token.role = (user as { role: Role }).role;
        }
        if ((user as { status?: UserStatus }).status) {
          token.status = (user as { status: UserStatus }).status;
        }
        token.designation =
          (user as { designation?: string | null }).designation ?? null;
        token.avatarUrl =
          (user as { avatarUrl?: string | null }).avatarUrl ??
          user.image ??
          null;
        token.departmentId =
          (user as { departmentId?: string | null }).departmentId ?? null;
      }
      if (trigger === "update" && session) {
        if (session.name) token.name = session.name;
        if (session.avatarUrl !== undefined)
          token.avatarUrl = session.avatarUrl;
        if (session.designation !== undefined)
          token.designation = session.designation;
        if (session.role !== undefined) token.role = session.role;
        if (session.status !== undefined) token.status = session.status;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token) {
        session.user.id = (token.id as string) || "";
        session.user.email = (token.email as string) || session.user.email;
        session.user.role = (token.role as Role) || "EMPLOYEE";
        session.user.status = (token.status as UserStatus) || "PENDING";
        session.user.designation = (token.designation as string | null) ?? null;
        session.user.avatarUrl = (token.avatarUrl as string | null) ?? null;
        session.user.departmentId =
          (token.departmentId as string | null) ?? null;
      }
      return session;
    },
  },
};
