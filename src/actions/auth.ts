"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/lib/auth";

export async function googleLoginAction() {
  await signIn("google", { redirectTo: "/dashboard" });
}

export async function mockRoleLoginAction(
  roleKey: "ADMIN" | "MANAGER" | "EMPLOYEE" | "PENDING"
) {
  try {
    await signIn("mock-role", {
      roleKey,
      redirect: false,
    });
    return {
      success: true,
      redirectTo: roleKey === "PENDING" ? "/pending-approval" : "/dashboard",
    };
  } catch (error) {
    if (error instanceof AuthError) {
      console.error("Mock role login AuthError:", error.type, error.message);
      return { error: `Mock login failed (${error.type}). Please try again.` };
    }
    throw error;
  }
}

export async function logoutAction() {
  await signOut({ redirect: false });
  return { success: true };
}
