import { NextResponse } from "next/server";
import { encode } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { invalidateWorkspaceCache } from "@/lib/cache/redis";
import { AUTH_SECRET_KEY, SESSION_COOKIE_NAME } from "@/lib/auth/auth.config";

const TEST_EMPLOYEE = {
  email: "employee.test@fishtailinfosolutions.com",
  name: "Alex Rivera (Test Employee)",
  role: "EMPLOYEE" as const,
  status: "ACTIVE" as const,
  designation: "Software Developer",
};

export async function POST() {
  try {
    const devDept = await prisma.department.findFirst({
      where: {
        OR: [{ name: "Development" }, { name: "Developement" }],
      },
      select: { id: true },
    });

    const dbUser = await prisma.user.upsert({
      where: { email: TEST_EMPLOYEE.email },
      update: {
        role: TEST_EMPLOYEE.role,
        status: TEST_EMPLOYEE.status,
        designation: TEST_EMPLOYEE.designation,
      },
      create: {
        name: TEST_EMPLOYEE.name,
        email: TEST_EMPLOYEE.email,
        passwordHash: "",
        role: TEST_EMPLOYEE.role,
        status: TEST_EMPLOYEE.status,
        designation: TEST_EMPLOYEE.designation,
        departmentId: devDept?.id ?? null,
      },
    });

    await invalidateWorkspaceCache();

    const token = await encode({
      secret: AUTH_SECRET_KEY,
      salt: SESSION_COOKIE_NAME,
      maxAge: 7 * 24 * 60 * 60,
      token: {
        sub: dbUser.id,
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        role: dbUser.role,
        status: dbUser.status,
        designation: dbUser.designation,
        avatarUrl: null,
        departmentId: dbUser.departmentId,
      },
    });

    const res = NextResponse.json({
      success: true,
      redirectTo: "/dashboard",
    });

    res.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: false,
      maxAge: 7 * 24 * 60 * 60,
    });

    return res;
  } catch (err) {
    console.error("Mock employee login error:", err);
    return NextResponse.json(
      { error: "Could not sign in as test employee." },
      { status: 500 }
    );
  }
}
