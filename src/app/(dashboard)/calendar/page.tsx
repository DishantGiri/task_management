import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/permissions";
import { getTasksList, getWorkspaceReferenceData } from "@/lib/queries";
import { TasksWorkspace } from "@/components/tasks/tasks-workspace";
import { Skeleton } from "@/components/ui/skeleton";

export default async function CalendarPage() {
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
        defaultView="calendar"
        title="Schedule & Calendar"
        subtitle="Track monthly and weekly deadlines across projects and assignees."
      />
    </Suspense>
  );
}
