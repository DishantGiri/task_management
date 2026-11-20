import { NextRequest, NextResponse } from "next/server";
import { encode } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import {
  AUTH_SECRET_KEY,
  SESSION_COOKIE_NAME,
  SUPER_ADMIN_EMAIL,
} from "@/lib/auth/auth.config";
import { invalidateWorkspaceCache } from "@/lib/cache/redis";

const MOCK_PROFILES = {
  ADMIN: {
    email: SUPER_ADMIN_EMAIL,
    name: "Dishant Giri",
    role: "ADMIN" as const,
    status: "ACTIVE" as const,
    designation: "Administrator",
  },
  MANAGER: {
    email: "manager.test@fishtailinfosolutions.com",
    name: "Sarah Chen (Manager)",
    role: "MANAGER" as const,
    status: "ACTIVE" as const,
    designation: "Project Manager",
  },
  EMPLOYEE: {
    email: "employee.test@fishtailinfosolutions.com",
    name: "Alex Rivera (Employee)",
    role: "EMPLOYEE" as const,
    status: "ACTIVE" as const,
    designation: "Software Developer",
  },
  PENDING: {
    email: "pending.test@fishtailinfosolutions.com",
    name: "Jordan Taylor (Pending)",
    role: "EMPLOYEE" as const,
    status: "PENDING" as const,
    designation: "Awaiting Admin Approval",
  },
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const roleKey = String(body?.roleKey || "").toUpperCase();
    const profile = MOCK_PROFILES[roleKey as keyof typeof MOCK_PROFILES];

    if (!profile) {
      return NextResponse.json(
        { error: "Invalid mock role selected." },
        { status: 400 }
      );
    }

    const dbUser = await prisma.user.upsert({
      where: { email: profile.email },
      update: {
        role: profile.role,
        status: profile.status,
        designation: profile.designation,
      },
      create: {
        name: profile.name,
        email: profile.email,
        passwordHash: "",
        role: profile.role,
        status: profile.status,
        designation: profile.designation,
      },
    });

    await invalidateWorkspaceCache().catch(() => {});

    const maxAge = 7 * 24 * 60 * 60;
    const jwtToken = await encode({
      token: {
        sub: dbUser.id,
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        role: dbUser.role,
        status: dbUser.status,
        designation: dbUser.designation,
        avatarUrl: dbUser.avatarUrl,
        departmentId: dbUser.departmentId,
      },
      secret: AUTH_SECRET_KEY,
      salt: SESSION_COOKIE_NAME,
      maxAge,
    });

    const isHttps =
      request.nextUrl.protocol === "https:" ||
      request.headers.get("x-forwarded-proto") === "https";

    const response = NextResponse.json({
      success: true,
      redirectTo: roleKey === "PENDING" ? "/pending-approval" : "/dashboard",
    });

    response.cookies.set(SESSION_COOKIE_NAME, jwtToken, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: isHttps,
      maxAge,
    });

    // Clear any legacy cookie names
    response.cookies.delete("authjs.session-token");
    response.cookies.delete("__Secure-authjs.session-token");

    return response;
  } catch (err) {
    console.error("Mock login route error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? `Login error: ${err.message}`
            : "Mock login failed on the server.",
      },
      { status: 500 }
    );
  }
}
