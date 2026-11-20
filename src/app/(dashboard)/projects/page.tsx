import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/permissions";
import { getProjectsList, getWorkspaceReferenceData } from "@/lib/queries";
import { ProjectsListClient } from "@/components/projects/projects-list-client";

export default async function ProjectsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?reauth=1");

  const [projects, ref] = await Promise.all([
    getProjectsList(user),
    getWorkspaceReferenceData(user),
  ]);

  return (
    <ProjectsListClient
      projects={projects}
      users={ref.users}
      departments={ref.departments}
      currentUserId={user.id}
      currentUserRole={user.role}
    />
  );
}
