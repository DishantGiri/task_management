"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loginSchema, registerSchema } from "@/lib/validations";

export async function loginAction(values: { email: string; password: string }) {
  const parsed = loginSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || "Invalid credentials" };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email.toLowerCase().trim(),
      password: parsed.data.password,
      redirect: false,
    });
    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.type === "CredentialsSignin") {
        return { error: "Invalid email or password, or account is inactive." };
      }
      return { error: "Authentication failed. Please try again." };
    }
    throw error;
  }
}

export async function registerAction(values: {
  name: string;
  email: string;
  password: string;
  designation?: string;
}) {
  const parsed = registerSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || "Invalid input" };
  }

  const email = parsed.data.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with this email already exists." };
  }

  const userCount = await prisma.user.count();
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  await prisma.user.create({
    data: {
      name: parsed.data.name.trim(),
      email,
      passwordHash,
      designation: parsed.data.designation?.trim() || "Team Member",
      role: userCount === 0 ? "ADMIN" : "EMPLOYEE",
      status: "ACTIVE",
    },
  });

  try {
    await signIn("credentials", {
      email,
      password: parsed.data.password,
      redirect: false,
    });
  } catch {
    return { success: true, redirectToLogin: true };
  }

  return { success: true };
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}
