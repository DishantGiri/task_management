import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/permissions";
import { getPersonalTasks } from "@/lib/queries";
import { PersonalTasksClient } from "@/components/tasks/personal-tasks-client";

export default async function PersonalTasksPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?reauth=1");

  const personalTasks = await getPersonalTasks(user.id);

  return <PersonalTasksClient initialTasks={personalTasks} />;
}
