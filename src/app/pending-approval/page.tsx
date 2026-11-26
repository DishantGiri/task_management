import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/permissions";
import {
  findMatchingHrmsEmployee,
  resolveOrCreateDepartmentId,
} from "@/lib/hrms";
import { invalidateWorkspaceCache } from "@/lib/cache/redis";
import { PendingApprovalClient } from "@/components/auth/pending-approval-client";

export default async function PendingApprovalPage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login?reauth=1");
  }

  if (user.status === "ACTIVE") {
    redirect("/dashboard");
  }

  // If the user is on hold (PENDING/INVITED) and was just added to Fishtail HRMS, auto-approve immediately
  if (user.status === "PENDING" || user.status === "INVITED") {
    const hrmsMatch = await findMatchingHrmsEmployee({
      email: user.email,
      name: user.name,
      googleAvatar: user.avatarUrl,
    });
    if (hrmsMatch) {
      const mappedDepartmentId =
        !user.departmentId && hrmsMatch.profession
          ? await resolveOrCreateDepartmentId(prisma, hrmsMatch.profession)
          : null;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          status: "ACTIVE",
          avatarUrl: user.avatarUrl || hrmsMatch.pictureUrl || null,
          ...(mappedDepartmentId ? { departmentId: mappedDepartmentId } : {}),
          designation:
            !user.designation || user.designation === "Awaiting Admin Approval"
              ? hrmsMatch.profession || "Team Member"
              : user.designation,
        },
      });
      await invalidateWorkspaceCache();
      redirect("/dashboard");
    }
  }

  return <PendingApprovalClient user={user} />;
}
