import { cache } from "react";
import { auth } from "@/lib/auth";
import { SUPER_ADMIN_EMAIL } from "@/lib/auth/auth.config";
import { prisma } from "@/lib/prisma";
import type {
  NotificationType,
  Role,
  TaskStatus,
  UserStatus,
} from "@prisma/client";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  designation: string | null;
  avatarUrl: string | null;
  departmentId: string | null;
}

export const getAuthenticatedUser = cache(
  async (): Promise<SessionUser | null> => {
    const session = await auth();
    const sessionId = session?.user?.id;
    const sessionEmail = session?.user?.email?.toLowerCase().trim();

    if (!sessionId && !sessionEmail) return null;

    let dbUser = await prisma.user.findFirst({
      where: sessionId
        ? {
            OR: [
              { id: sessionId },
              ...(sessionEmail ? [{ email: sessionEmail }] : []),
            ],
          }
        : { email: sessionEmail },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        designation: true,
        avatarUrl: true,
        departmentId: true,
      },
    });

    if (!dbUser && sessionEmail) {
      const isSuper = sessionEmail === SUPER_ADMIN_EMAIL;
      dbUser = await prisma.user.create({
        data: {
          name: session?.user?.name || sessionEmail.split("@")[0],
          email: sessionEmail,
          passwordHash: "",
          avatarUrl: session?.user?.avatarUrl || null,
          role: isSuper ? "ADMIN" : "EMPLOYEE",
          status: isSuper ? "ACTIVE" : "PENDING",
          designation: isSuper
            ? "Company Administrator"
            : "Awaiting Admin Approval",
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          designation: true,
          avatarUrl: true,
          departmentId: true,
        },
      });
    }

    if (!dbUser) return null;

    if (
      dbUser.email.toLowerCase() === SUPER_ADMIN_EMAIL &&
      (dbUser.role !== "ADMIN" || dbUser.status !== "ACTIVE")
    ) {
      dbUser = await prisma.user.update({
        where: { id: dbUser.id },
        data: { role: "ADMIN", status: "ACTIVE" },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          designation: true,
          avatarUrl: true,
          departmentId: true,
        },
      });
    }

    return dbUser;
  }
);

export const getCurrentUser = cache(
  async (): Promise<SessionUser | null> => {
    const user = await getAuthenticatedUser();
    if (!user || user.status !== "ACTIVE") {
      return null;
    }
    return user;
  }
);

export async function requireAuth(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}

export async function requireRole(allowedRoles: Role[]): Promise<SessionUser> {
  const user = await requireAuth();
  if (!allowedRoles.includes(user.role)) {
    throw new Error("FORBIDDEN");
  }
  return user;
}

export async function canAccessProject(
  user: SessionUser,
  projectId: string
): Promise<boolean> {
  if (user.role === "ADMIN") return true;

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      OR: [
        { managerId: user.id },
        { members: { some: { userId: user.id } } },
        {
          tasks: {
            some: {
              OR: [
                { assigneeId: user.id },
                { collaborators: { some: { userId: user.id } } },
              ],
            },
          },
        },
      ],
    },
    select: { id: true },
  });

  return !!project;
}

export async function canManageProject(
  user: SessionUser,
  projectId: string
): Promise<boolean> {
  if (user.role === "ADMIN") return true;
  if (user.role !== "MANAGER") return false;

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      OR: [
        { managerId: user.id },
        { members: { some: { userId: user.id, role: "LEAD" } } },
      ],
    },
    select: { id: true },
  });

  return !!project;
}

export async function canCreateTaskInProject(
  user: SessionUser,
  projectId: string,
  parentId?: string | null
): Promise<boolean> {
  if (user.role === "ADMIN") return true;
  if (user.role === "MANAGER") {
    return canAccessProject(user, projectId);
  }
  // Employee can create subtasks on tasks assigned to them or where they collaborate
  if (parentId) {
    const parent = await prisma.task.findFirst({
      where: {
        id: parentId,
        projectId,
        OR: [
          { assigneeId: user.id },
          { collaborators: { some: { userId: user.id } } },
        ],
      },
      select: { id: true },
    });
    return !!parent;
  }
  return false;
}

export async function canEditTask(
  user: SessionUser,
  taskId: string
): Promise<{ allowed: boolean; fullEdit: boolean }> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      projectId: true,
      assigneeId: true,
      creatorId: true,
      parentId: true,
      parent: {
        select: {
          assigneeId: true,
          collaborators: { select: { userId: true } },
        },
      },
      collaborators: { select: { userId: true } },
      project: {
        select: {
          managerId: true,
          members: { where: { userId: user.id }, select: { role: true } },
        },
      },
    },
  });

  if (!task) return { allowed: false, fullEdit: false };
  if (user.role === "ADMIN") return { allowed: true, fullEdit: true };

  if (user.role === "MANAGER") {
    const isProjectMemberOrManager =
      task.project.managerId === user.id || task.project.members.length > 0;
    return {
      allowed: isProjectMemberOrManager,
      fullEdit: isProjectMemberOrManager,
    };
  }

  const isAssigneeOrCollaborator =
    task.assigneeId === user.id ||
    task.collaborators.some((c) => c.userId === user.id) ||
    task.creatorId === user.id ||
    task.parent?.assigneeId === user.id ||
    task.parent?.collaborators.some((c) => c.userId === user.id);

  return {
    allowed: !!isAssigneeOrCollaborator,
    fullEdit: task.parentId !== null && !!isAssigneeOrCollaborator,
  };
}

export const getAccessibleProjectIds = cache(
  async (user: SessionUser): Promise<string[] | null> => {
    if (user.role === "ADMIN") return null; // null means unrestricted

    const projects = await prisma.project.findMany({
      where: {
        OR: [
          { managerId: user.id },
          { members: { some: { userId: user.id } } },
          {
            tasks: {
              some: {
                OR: [
                  { assigneeId: user.id },
                  { collaborators: { some: { userId: user.id } } },
                ],
              },
            },
          },
        ],
      },
      select: { id: true },
    });

    return projects.map((p) => p.id);
  }
);

export async function generateNextTaskKey(projectId: string): Promise<string> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { code: true },
  });

  const prefix = project?.code || "TSK";
  const existing = await prisma.task.findMany({
    where: { projectId },
    select: { taskKey: true },
  });

  let maxNum = 0;
  for (const t of existing) {
    const match = t.taskKey.match(/-(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }

  return `${prefix}-${maxNum + 1}`;
}

export async function recalculateParentProgress(
  parentId: string | null | undefined
): Promise<void> {
  if (!parentId) return;

  const subtasks = await prisma.task.findMany({
    where: { parentId },
    select: { status: true, progress: true },
  });

  if (subtasks.length === 0) return;

  const statusScore = (status: TaskStatus): number => {
    switch (status) {
      case "DONE":
        return 100;
      case "IN_REVIEW":
        return 75;
      case "IN_PROGRESS":
        return 40;
      default:
        return 0;
    }
  };

  const completedCount = subtasks.filter((s) => s.status === "DONE").length;
  const weightedSum = subtasks.reduce(
    (sum, s) =>
      sum +
      (s.status === "DONE" ? 100 : Math.max(s.progress, statusScore(s.status))),
    0
  );
  const rawProgress =
    completedCount === subtasks.length
      ? 100
      : Math.round(weightedSum / subtasks.length);

  const currentParent = await prisma.task.findUnique({
    where: { id: parentId },
    select: { status: true },
  });

  // Never show 100% while the main task itself is not in DONE status
  const progress =
    currentParent?.status === "DONE" ? 100 : Math.min(rawProgress, 90);

  const parent = await prisma.task.update({
    where: { id: parentId },
    data: { progress },
    select: { parentId: true },
  });

  if (parent.parentId) {
    await recalculateParentProgress(parent.parentId);
  }
}

export async function createActivityLog(params: {
  action: string;
  entityType: "TASK" | "PROJECT" | "USER";
  entityId: string;
  description: string;
  actorId: string;
  projectId?: string | null;
  taskId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  return prisma.activityLog.create({
    data: {
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      description: params.description,
      actorId: params.actorId,
      projectId: params.projectId ?? null,
      taskId: params.taskId ?? null,
      metadata: params.metadata ? (params.metadata as object) : undefined,
    },
  });
}

export async function createNotification(params: {
  userId: string;
  actorId?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  link?: string | null;
  taskId?: string | null;
}) {
  if (params.actorId && params.userId === params.actorId) {
    return null;
  }
  return prisma.notification.create({
    data: {
      userId: params.userId,
      actorId: params.actorId ?? null,
      type: params.type,
      title: params.title,
      message: params.message,
      link: params.link ?? null,
      taskId: params.taskId ?? null,
    },
  });
}

const deadlineSyncCache = new Map<string, number>();

export async function syncUpcomingDeadlineNotifications(userId: string) {
  const nowMs = Date.now();
  const lastSync = deadlineSyncCache.get(userId) || 0;
  if (nowMs - lastSync < 5 * 60 * 1000) {
    return;
  }
  deadlineSyncCache.set(userId, nowMs);

  const now = new Date();
  const in48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const upcomingTasks = await prisma.task.findMany({
    where: {
      status: { not: "DONE" },
      dueDate: {
        gte: now,
        lte: in48Hours,
      },
      OR: [
        { assigneeId: userId },
        { collaborators: { some: { userId } } },
      ],
    },
    select: {
      id: true,
      taskKey: true,
      title: true,
      dueDate: true,
      projectId: true,
    },
    take: 10,
  });

  if (upcomingTasks.length === 0) return;

  const existingNotifs = await prisma.notification.findMany({
    where: {
      userId,
      type: "DEADLINE_APPROACHING",
      taskId: { in: upcomingTasks.map((t) => t.id) },
      createdAt: { gte: last24Hours },
    },
    select: { taskId: true },
  });

  const existingTaskIds = new Set(existingNotifs.map((n) => n.taskId));

  const toCreate = upcomingTasks.filter((t) => !existingTaskIds.has(t.id));
  if (toCreate.length === 0) return;

  await prisma.notification.createMany({
    data: toCreate.map((task) => ({
      userId,
      type: "DEADLINE_APPROACHING",
      title: `Upcoming deadline: ${task.taskKey}`,
      message: `"${task.title}" is due soon. Review progress and update its status.`,
      link: `/tasks?taskId=${task.id}`,
      taskId: task.id,
    })),
  });
}
