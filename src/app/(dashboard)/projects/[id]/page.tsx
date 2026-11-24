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
  if (!user) redirect("/login?reauth=1");

  const { id } = await params;
  const hasAccess = await canAccessProject(user, id);
  if (!hasAccess) notFound();

  const [projects, tasks, ref, canManage, activities, rawMilestones, rawPosts] =
    await Promise.all([
      getProjectsList(user),
      getTasksList(user, { projectId: id }),
      getWorkspaceReferenceData(user),
      canManageProject(user, id),
      user.role === "EMPLOYEE"
        ? Promise.resolve([])
        : prisma.activityLog.findMany({
            where:
              user.role === "ADMIN"
                ? { projectId: id }
                : {
                    projectId: id,
                    entityType: "TASK",
                    action: {
                      in: [
                        "TASK_CREATED",
                        "STATUS_CHANGED",
                        "ASSIGNEE_CHANGED",
                        "SUBTASK_ADDED",
                        "COMMENT_ADDED",
                        "ATTACHMENT_UPLOADED",
                      ],
                    },
                    actor: { role: { not: "ADMIN" } },
                  },
            orderBy: { createdAt: "desc" },
            take: 30,
            include: {
              actor: { select: { id: true, name: true, avatarUrl: true } },
            },
          }),
      prisma.milestone.findMany({
        where: { projectId: id },
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
        include: {
          createdBy: { select: { id: true, name: true, avatarUrl: true } },
          tasks: {
            where: { parentId: null },
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              taskKey: true,
              title: true,
              status: true,
              priority: true,
              dueDate: true,
              assignee: { select: { id: true, name: true, avatarUrl: true } },
            },
          },
        },
      }),
      prisma.projectPost.findMany({
        where: { projectId: id },
        orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
        include: {
          author: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
              role: true,
              designation: true,
            },
          },
        },
      }),
    ]);

  const project = projects.find((p) => p.id === id);
  if (!project) notFound();

  const milestones = rawMilestones.map((m) => {
    const total = m.tasks.length;
    const completed = m.tasks.filter((t) => t.status === "DONE").length;
    const progress =
      m.status === "COMPLETED"
        ? 100
        : total > 0
        ? Math.round((completed / total) * 100)
        : 0;
    return {
      id: m.id,
      title: m.title,
      description: m.description,
      status: m.status,
      dueDate: m.dueDate?.toISOString() ?? null,
      projectId: m.projectId,
      createdAt: m.createdAt.toISOString(),
      createdBy: m.createdBy,
      tasks: m.tasks.map((t) => ({
        ...t,
        dueDate: t.dueDate?.toISOString() ?? null,
      })),
      taskStats: { total, completed, progress },
    };
  });

  const posts = rawPosts.map((p) => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
  }));

  return (
    <ProjectWorkspaceClient
      project={project}
      tasks={tasks}
      milestones={milestones}
      posts={posts}
      allUsers={ref.users}
      departments={ref.departments}
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
