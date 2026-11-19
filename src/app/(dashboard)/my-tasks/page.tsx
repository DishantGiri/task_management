import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/permissions";
import {
  getPersonalTasks,
  getTasksList,
  getWorkspaceReferenceData,
} from "@/lib/queries";
import { MyTasksClient } from "@/components/tasks/my-tasks-client";

export default async function MyTasksPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?reauth=1");

  const [myTasks, personalTasks, ref] = await Promise.all([
    getTasksList(user, { onlyMine: true, includeSubtasksAsTopLevel: true }),
    getPersonalTasks(user.id),
    getWorkspaceReferenceData(user),
  ]);

  return (
    <MyTasksClient
      initialTasks={myTasks}
      initialPersonalTasks={personalTasks}
      users={ref.users}
      tags={ref.tags}
      currentUserId={user.id}
      currentUserRole={user.role}
    />
  );
}
