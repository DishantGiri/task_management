import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/permissions";
import { PendingApprovalClient } from "@/components/auth/pending-approval-client";

export default async function PendingApprovalPage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login?reauth=1");
  }

  if (user.status === "ACTIVE") {
    redirect("/dashboard");
  }

  return <PendingApprovalClient user={user} />;
}
