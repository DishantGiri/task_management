import { Suspense } from "react";
import { redirect } from "next/navigation";
import { startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/permissions";
import { TeamClient } from "@/components/employees/team-client";
import { Skeleton } from "@/components/ui/skeleton";

export default async function TeamPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?reauth=1");

  const [users, departments] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ status: "asc" }, { name: "asc" }],
      include: {
        department: { select: { id: true, name: true } },
        assignedTasks: {
          where: { parentId: null },
          select: { id: true, status: true, dueDate: true },
        },
        _count: {
          select: { projectMemberships: true },
        },
      },
    }),
    prisma.department.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const todayStart = startOfDay(new Date());

  const rows = users.map((u) => {
    const totalTasks = u.assignedTasks.length;
    const completedTasks = u.assignedTasks.filter(
      (t) => t.status === "DONE"
    ).length;
    const activeTasks = totalTasks - completedTasks;
    const overdueTasks = u.assignedTasks.filter(
      (t) => t.status !== "DONE" && t.dueDate && t.dueDate < todayStart
    ).length;

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      avatarUrl: u.avatarUrl,
      designation: u.designation,
      role: u.role,
      status: u.status,
      departmentId: u.departmentId,
      department: u.department,
      createdAt: u.createdAt.toISOString(),
      stats: {
        totalTasks,
        completedTasks,
        activeTasks,
        overdueTasks,
        projectCount: u._count.projectMemberships,
      },
    };
  });

  return (
    <Suspense fallback={<Skeleton className="h-[500px] w-full" />}>
      <TeamClient
        employees={rows}
        departments={departments}
        currentUserId={user.id}
        currentUserRole={user.role}
      />
    </Suspense>
  );
}
