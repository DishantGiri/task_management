import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  canAccessProject,
  canManageProject,
  getCurrentUser,
} from "@/lib/permissions";
import {
  getProjectsList,
  getTasksList,
  getWorkspaceReferenceData,
} from "@/lib/queries";
import { ProjectWorkspaceClient } from "@/components/projects/project-workspace-client";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const hasAccess = await canAccessProject(user, id);
  if (!hasAccess) notFound();

  const [projects, tasks, ref, canManage, activities] = await Promise.all([
    getProjectsList(user),
    getTasksList(user, { projectId: id }),
    getWorkspaceReferenceData(user),
    canManageProject(user, id),
    prisma.activityLog.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        actor: { select: { id: true, name: true, avatarUrl: true } },
      },
    }),
  ]);

  const project = projects.find((p) => p.id === id);
  if (!project) notFound();

  return (
    <ProjectWorkspaceClient
      project={project}
      tasks={tasks}
      allUsers={ref.users}
      tags={ref.tags}
      activities={activities.map((a) => ({
        ...a,
        createdAt: a.createdAt.toISOString(),
      }))}
      currentUserId={user.id}
      currentUserRole={user.role}
      canManage={canManage}
    />
  );
}
