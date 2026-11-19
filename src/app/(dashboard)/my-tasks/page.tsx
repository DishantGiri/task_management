import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/permissions";
import { getTasksList, getWorkspaceReferenceData } from "@/lib/queries";
import { MyTasksClient } from "@/components/tasks/my-tasks-client";

export default async function MyTasksPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [myTasks, ref] = await Promise.all([
    getTasksList(user, { onlyMine: true, includeSubtasksAsTopLevel: true }),
    getWorkspaceReferenceData(user),
  ]);

  return (
    <MyTasksClient
      initialTasks={myTasks}
      users={ref.users}
      tags={ref.tags}
      currentUserId={user.id}
      currentUserRole={user.role}
    />
  );
}
