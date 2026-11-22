import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { withCache } from "@/lib/cache/redis";
import {
  getAccessibleProjectIds,
  type SessionUser,
} from "@/lib/permissions";
import type { Prisma } from "@prisma/client";
import type {
  PersonalChecklistItem,
  PersonalTaskItem,
  ProjectListItem,
  TaskListItem,
} from "@/types";
import { startOfDay, subDays, format } from "date-fns";

export const getPersonalTasks = cache(
  async (userId: string): Promise<PersonalTaskItem[]> => {
    return withCache(`meridian:personal:${userId}`, 60, async () => {
      const rows = await prisma.personalTask.findMany({
        where: { userId },
        orderBy: [
          { isPinned: "desc" },
          { status: "asc" },
          { dueDate: "asc" },
          { updatedAt: "desc" },
        ],
      });

      return rows.map((row) => {
        const checklist: PersonalChecklistItem[] = Array.isArray(row.checklist)
          ? (row.checklist as unknown as PersonalChecklistItem[]).map(
              (item) => ({
                id: String(item.id),
                title: String(item.title),
                completed: Boolean(item.completed),
              })
            )
          : [];

        return {
          id: row.id,
          title: row.title,
          notes: row.notes,
          status: row.status,
          priority: row.priority,
          category: row.category,
          dueDate: row.dueDate?.toISOString() ?? null,
          isPinned: row.isPinned,
          checklist,
          completedAt: row.completedAt?.toISOString() ?? null,
          userId: row.userId,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        };
      });
    });
  }
);

const userSelect = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true,
  designation: true,
  role: true,
  status: true,
  department: { select: { id: true, name: true } },
};

export const getWorkspaceReferenceData = cache(
  async (user: SessionUser) => {
    return withCache(
      `meridian:ref:${user.id}:${user.role}`,
      90,
      async () => {
        const accessibleProjectIds = await getAccessibleProjectIds(user);

        const [projects, users, tags, departments] = await Promise.all([
          prisma.project.findMany({
            where:
              accessibleProjectIds !== null
                ? { id: { in: accessibleProjectIds } }
                : undefined,
            orderBy: { name: "asc" },
            select: {
              id: true,
              code: true,
              name: true,
              color: true,
              status: true,
              priority: true,
            },
          }),
          prisma.user.findMany({
            where: { status: { not: "INACTIVE" } },
            orderBy: { name: "asc" },
            select: userSelect,
          }),
          prisma.tag.findMany({
            orderBy: { name: "asc" },
            select: { id: true, name: true, color: true },
          }),
          prisma.department.findMany({
            orderBy: { name: "asc" },
            select: { id: true, name: true, description: true },
          }),
        ]);

        return { projects, users, tags, departments };
      }
    );
  }
);

export async function getTasksList(
  user: SessionUser,
  options?: {
    projectId?: string;
    onlyMine?: boolean;
    includeSubtasksAsTopLevel?: boolean;
  }
): Promise<TaskListItem[]> {
  const cacheKey = `meridian:tasks:${user.id}:${user.role}:${
    options?.projectId || "all"
  }:${options?.onlyMine ? "mine" : "all"}:${
    options?.includeSubtasksAsTopLevel ? "subs" : "top"
  }`;

  return withCache(cacheKey, 45, async () => {
    const accessibleProjectIds = await getAccessibleProjectIds(user);

    const where: Prisma.TaskWhereInput = {};
    if (!options?.includeSubtasksAsTopLevel) {
      where.parentId = null;
    }
    if (accessibleProjectIds !== null) {
      where.projectId = { in: accessibleProjectIds };
    }
    if (options?.projectId) {
      where.projectId = options.projectId;
    }
    if (options?.onlyMine) {
      where.OR = [
        { assigneeId: user.id },
        { collaborators: { some: { userId: user.id } } },
      ];
    }

    const tasks = await prisma.task.findMany({
      where,
      orderBy: [{ position: "asc" }, { createdAt: "desc" }],
      include: {
        project: { select: { id: true, code: true, name: true, color: true } },
        assignee: { select: userSelect },
        collaborators: {
          include: { user: { select: userSelect } },
        },
        tags: {
          include: { tag: { select: { id: true, name: true, color: true } } },
        },
        subtasks: {
          orderBy: [{ position: "asc" }, { createdAt: "asc" }],
          include: {
            assignee: { select: userSelect },
            _count: {
              select: { subtasks: true, comments: true, attachments: true },
            },
          },
        },
        dependencies: {
          include: {
            dependsOn: {
              select: { id: true, taskKey: true, title: true, status: true },
            },
          },
        },
        _count: { select: { subtasks: true, comments: true, attachments: true } },
      },
    });

    return tasks.map((t) => ({
      ...t,
      startDate: t.startDate?.toISOString() ?? null,
      dueDate: t.dueDate?.toISOString() ?? null,
      completedAt: t.completedAt?.toISOString() ?? null,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      subtasks: t.subtasks.map((s) => ({
        ...s,
        startDate: s.startDate?.toISOString() ?? null,
        dueDate: s.dueDate?.toISOString() ?? null,
      })),
    }));
  });
}

export const getProjectsList = cache(
  async (user: SessionUser): Promise<ProjectListItem[]> => {
    return withCache(
      `meridian:projects:v3:${user.id}:${user.role}`,
      60,
      async () => {
        const accessibleProjectIds = await getAccessibleProjectIds(user);

        const projects = await prisma.project.findMany({
          where:
            accessibleProjectIds !== null
              ? { id: { in: accessibleProjectIds } }
              : undefined,
          orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
          include: {
            manager: { select: userSelect },
            members: {
              orderBy: { joinedAt: "asc" },
              include: { user: { select: userSelect } },
            },
            tasks: {
              where: { parentId: null },
              select: { id: true, status: true, dueDate: true, progress: true },
            },
          },
        });

        const todayStart = startOfDay(new Date());

        return projects.map((p) => {
          const total = p.tasks.length;
          const completed = p.tasks.filter((t) => t.status === "DONE").length;
          const inProgress = p.tasks.filter(
            (t) => t.status === "IN_PROGRESS" || t.status === "IN_REVIEW"
          ).length;
          const overdue = p.tasks.filter(
            (t) => t.status !== "DONE" && t.dueDate && t.dueDate < todayStart
          ).length;
          const progress =
            total === 0 ? 0 : Math.round((completed / total) * 100);

          return {
            id: p.id,
            code: p.code,
            name: p.name,
            description: p.description,
            color: p.color,
            status: p.status,
            priority: p.priority,
            startDate: p.startDate?.toISOString() ?? null,
            endDate: p.endDate?.toISOString() ?? null,
            managerId: p.managerId,
            manager: p.manager,
            members: p.members.map((m) => ({
              id: m.id,
              role: m.role,
              user: m.user,
            })),
            taskStats: { total, completed, inProgress, overdue, progress },
          };
        });
      }
    );
  }
);

export const getDashboardData = cache(async (user: SessionUser) => {
  return withCache(
    `meridian:dashboard:v3:${user.id}:${user.role}`,
    45,
    async () => {
  const accessibleProjectIds = await getAccessibleProjectIds(user);
  const projectFilter =
    accessibleProjectIds !== null ? { in: accessibleProjectIds } : undefined;

  const NON_ADMIN_TASK_ACTIONS = [
    "TASK_CREATED",
    "STATUS_CHANGED",
    "ASSIGNEE_CHANGED",
    "SUBTASK_ADDED",
    "COMMENT_ADDED",
    "ATTACHMENT_UPLOADED",
  ];

  const now = new Date();
  const todayStart = startOfDay(now);

  const [
    totalEmployees,
    activeProjectsCount,
    allTopTasks,
    projects,
    recentActivities,
    upcomingTasks,
    employeesWithTasks,
  ] = await Promise.all([
    prisma.user.count({ where: { status: { not: "INACTIVE" } } }),
    prisma.project.count({
      where: {
        status: "ACTIVE",
        ...(projectFilter ? { id: projectFilter } : {}),
      },
    }),
    prisma.task.findMany({
      where: {
        parentId: null,
        ...(projectFilter ? { projectId: projectFilter } : {}),
      },
      select: {
        id: true,
        status: true,
        priority: true,
        dueDate: true,
        completedAt: true,
        createdAt: true,
      },
    }),
    getProjectsList(user),
    user.role === "EMPLOYEE"
      ? Promise.resolve([])
      : prisma.activityLog.findMany({
          where:
            user.role === "ADMIN"
              ? undefined
              : {
                  entityType: "TASK",
                  action: { in: NON_ADMIN_TASK_ACTIONS },
                  ...(projectFilter ? { projectId: projectFilter } : {}),
                  actor: { role: { not: "ADMIN" } },
                },
          orderBy: { createdAt: "desc" },
          take: 10,
          include: {
            actor: {
              select: { id: true, name: true, avatarUrl: true, role: true },
            },
            project: {
              select: { id: true, name: true, code: true, color: true },
            },
          },
        }),
    prisma.task.findMany({
      where: {
        status: { not: "DONE" },
        dueDate: { not: null },
        ...(projectFilter ? { projectId: projectFilter } : {}),
      },
      orderBy: { dueDate: "asc" },
      take: 8,
      include: {
        project: { select: { id: true, code: true, name: true, color: true } },
        assignee: { select: { id: true, name: true, avatarUrl: true } },
      },
    }),
    prisma.user.findMany({
      where: { status: { not: "INACTIVE" } },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        designation: true,
        avatarUrl: true,
        role: true,
        department: { select: { name: true } },
        assignedTasks: {
          where: {
            parentId: null,
            ...(projectFilter ? { projectId: projectFilter } : {}),
          },
          select: { id: true, status: true, dueDate: true },
        },
      },
    }),
  ]);

  const totalTasks = allTopTasks.length;
  const completedTasks = allTopTasks.filter((t) => t.status === "DONE").length;
  const pendingTasks = totalTasks - completedTasks;
  const overdueTasks = allTopTasks.filter(
    (t) => t.status !== "DONE" && t.dueDate && t.dueDate < todayStart
  ).length;

  // Build 7-day completion & creation trend from real DB timestamps
  const trendData = Array.from({ length: 7 }).map((_, i) => {
    const day = subDays(todayStart, 6 - i);
    const nextDay = new Date(day.getTime() + 24 * 60 * 60 * 1000);
    const completed = allTopTasks.filter(
      (t) => t.completedAt && t.completedAt >= day && t.completedAt < nextDay
    ).length;
    const created = allTopTasks.filter(
      (t) => t.createdAt >= day && t.createdAt < nextDay
    ).length;
    return {
      date: format(day, "MMM d"),
      completed,
      created,
    };
  });

  const statusDistribution = [
    {
      name: "To Do",
      value: allTopTasks.filter((t) => t.status === "TODO").length,
      color: "#94A3B8",
    },
    {
      name: "In Progress",
      value: allTopTasks.filter((t) => t.status === "IN_PROGRESS").length,
      color: "#3B82F6",
    },
    {
      name: "In Review",
      value: allTopTasks.filter((t) => t.status === "IN_REVIEW").length,
      color: "#F59E0B",
    },
    {
      name: "Done",
      value: completedTasks,
      color: "#16A34A",
    },
  ];

  const workload = employeesWithTasks
    .map((emp) => {
      const total = emp.assignedTasks.length;
      const done = emp.assignedTasks.filter((t) => t.status === "DONE").length;
      const active = total - done;
      const overdue = emp.assignedTasks.filter(
        (t) => t.status !== "DONE" && t.dueDate && t.dueDate < todayStart
      ).length;
      return {
        id: emp.id,
        name: emp.name,
        designation: emp.designation || emp.role,
        department: emp.department?.name || "General",
        avatarUrl: emp.avatarUrl,
        total,
        active,
        done,
        overdue,
      };
    })
    .sort((a, b) => b.active - a.active);

  return {
    stats: {
      totalEmployees,
      activeProjects: activeProjectsCount,
      totalTasks,
      completedTasks,
      pendingTasks,
      overdueTasks,
      completionRate:
        totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
    },
    projects: projects.slice(0, 6),
    recentActivities: recentActivities.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
    })),
    upcomingTasks: upcomingTasks.map((t) => ({
      id: t.id,
      taskKey: t.taskKey,
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate?.toISOString() ?? null,
      project: t.project,
      assignee: t.assignee,
    })),
    workload: workload.slice(0, 7),
    trendData,
    statusDistribution,
  };
    }
  );
});
