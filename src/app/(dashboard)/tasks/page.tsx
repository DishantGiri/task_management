import { Suspense } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAccessibleProjectIds, getCurrentUser } from "@/lib/permissions";
import { getTasksList, getWorkspaceReferenceData } from "@/lib/queries";
import { TasksWorkspace } from "@/components/tasks/tasks-workspace";
import { Skeleton } from "@/components/ui/skeleton";

export default async function AllTasksPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?reauth=1");

  const accessibleProjectIds = await getAccessibleProjectIds(user);

  const [tasks, ref, rawMilestones] = await Promise.all([
    getTasksList(user),
    getWorkspaceReferenceData(user),
    prisma.milestone.findMany({
      where:
        accessibleProjectIds !== null
          ? { projectId: { in: accessibleProjectIds } }
          : undefined,
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      include: {
        project: { select: { name: true, color: true } },
        tasks: {
          where: { parentId: null },
          select: { status: true },
        },
      },
    }),
  ]);

  const milestones = rawMilestones.map((m) => {
    const total = m.tasks.length;
    const completed = m.tasks.filter((t) => t.status === "DONE").length;
    return {
      id: m.id,
      title: m.title,
      status: m.status,
      dueDate: m.dueDate?.toISOString() ?? null,
      projectId: m.projectId,
      projectName: m.project.name,
      projectColor: m.project.color,
      progress:
        m.status === "COMPLETED"
          ? 100
          : total > 0
          ? Math.round((completed / total) * 100)
          : 0,
    };
  });

  return (
    <Suspense fallback={<Skeleton className="h-[520px] w-full" />}>
      <TasksWorkspace
        initialTasks={tasks}
        milestones={milestones}
        projects={ref.projects}
        users={ref.users}
        tags={ref.tags}
        currentUserId={user.id}
        currentUserRole={user.role}
        defaultView="kanban"
        title="All Tasks"
        subtitle="Manage work across Kanban board, list, calendar, and timeline views."
      />
    </Suspense>
  );
}
