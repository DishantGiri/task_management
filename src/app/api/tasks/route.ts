import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAccessibleProjectIds, getCurrentUser } from "@/lib/permissions";
import { createTaskAction } from "@/actions/tasks";
import { withCache } from "@/lib/cache/redis";
import type { Prisma, Priority, TaskStatus } from "@prisma/client";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  const status = searchParams.get("status") as TaskStatus | null;
  const priority = searchParams.get("priority") as Priority | null;
  const assigneeId = searchParams.get("assigneeId");
  const search = searchParams.get("q")?.trim();
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));

  const accessibleProjectIds = await getAccessibleProjectIds(user);

  const where: Prisma.TaskWhereInput = {
    parentId: null,
  };

  if (accessibleProjectIds !== null) {
    where.projectId = { in: accessibleProjectIds };
  }
  if (projectId) {
    if (accessibleProjectIds !== null && !accessibleProjectIds.includes(projectId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    where.projectId = projectId;
  }
  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (assigneeId) where.assigneeId = assigneeId;
  if (search) {
    where.OR = [
      { title: { contains: search } },
      { taskKey: { contains: search } },
      { description: { contains: search } },
    ];
  }

  const cacheKey = `meridian:api:tasks:${user.id}:${projectId || "all"}:${
    status || "all"
  }:${priority || "all"}:${assigneeId || "all"}:${search || ""}:${page}:${limit}`;

  const payload = await withCache(cacheKey, 15, async () => {
    const [total, tasks] = await Promise.all([
      prisma.task.count({ where }),
      prisma.task.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ position: "asc" }, { createdAt: "desc" }],
        select: {
          id: true,
          taskKey: true,
          title: true,
          status: true,
          priority: true,
          position: true,
          progress: true,
          startDate: true,
          dueDate: true,
          completedAt: true,
          projectId: true,
          assigneeId: true,
          creatorId: true,
          parentId: true,
          createdAt: true,
          updatedAt: true,
          project: { select: { id: true, code: true, name: true, color: true } },
          assignee: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
              designation: true,
              role: true,
            },
          },
          collaborators: {
            select: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  avatarUrl: true,
                  designation: true,
                  role: true,
                },
              },
            },
          },
          tags: {
            select: { tag: { select: { id: true, name: true, color: true } } },
          },
          subtasks: {
            orderBy: { position: "asc" },
            select: {
              id: true,
              taskKey: true,
              title: true,
              status: true,
              priority: true,
              progress: true,
              startDate: true,
              dueDate: true,
              assignee: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  avatarUrl: true,
                  designation: true,
                  role: true,
                },
              },
            },
          },
          dependencies: {
            select: {
              dependsOnId: true,
              dependsOn: {
                select: { id: true, taskKey: true, title: true, status: true },
              },
            },
          },
          _count: {
            select: { subtasks: true, comments: true, attachments: true },
          },
        },
      }),
    ]);

    return {
      data: tasks,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  });

  return NextResponse.json(payload);
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const result = await createTaskAction(body);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result, { status: 201 });
}
