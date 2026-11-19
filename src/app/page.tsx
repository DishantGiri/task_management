import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/permissions";

export default async function HomePage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login");
  }
  if (user.status !== "ACTIVE") {
    redirect("/pending-approval");
  }
  redirect("/dashboard");
}
