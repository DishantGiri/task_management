"use server";

import { signIn, signOut } from "@/lib/auth";

export async function googleLoginAction() {
  await signIn("google", { redirectTo: "/dashboard" });
}

export async function googlePopupLoginAction() {
  await signIn("google", { redirectTo: "/popup-complete" });
}

export async function logoutAction() {
  await signOut({ redirect: false });
  return { success: true };
}
