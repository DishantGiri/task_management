import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/permissions";
import { getTasksList, getWorkspaceReferenceData } from "@/lib/queries";
import { TasksWorkspace } from "@/components/tasks/tasks-workspace";
import { Skeleton } from "@/components/ui/skeleton";

export default async function AllTasksPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?reauth=1");

  const [tasks, ref] = await Promise.all([
    getTasksList(user),
    getWorkspaceReferenceData(user),
  ]);

  return (
    <Suspense fallback={<Skeleton className="h-[520px] w-full" />}>
      <TasksWorkspace
        initialTasks={tasks}
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
