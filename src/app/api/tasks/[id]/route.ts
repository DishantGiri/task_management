import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canAccessProject, getCurrentUser } from "@/lib/permissions";
import { deleteTaskAction, updateTaskAction } from "@/actions/tasks";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      project: { select: { id: true, code: true, name: true, color: true } },
      parent: { select: { id: true, taskKey: true, title: true } },
      creator: {
        select: { id: true, name: true, email: true, avatarUrl: true, designation: true, role: true },
      },
      assignee: {
        select: { id: true, name: true, email: true, avatarUrl: true, designation: true, role: true },
      },
      collaborators: {
        include: {
          user: {
            select: { id: true, name: true, email: true, avatarUrl: true, designation: true, role: true },
          },
        },
      },
      tags: { include: { tag: true } },
      subtasks: {
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        include: {
          assignee: {
            select: { id: true, name: true, email: true, avatarUrl: true, designation: true, role: true },
          },
          _count: { select: { subtasks: true, comments: true, attachments: true } },
        },
      },
      dependencies: {
        include: {
          dependsOn: { select: { id: true, taskKey: true, title: true, status: true } },
        },
      },
      comments: {
        orderBy: { createdAt: "asc" },
        include: {
          author: {
            select: { id: true, name: true, email: true, avatarUrl: true, designation: true, role: true },
          },
        },
      },
      attachments: {
        orderBy: { createdAt: "desc" },
        include: {
          uploadedBy: {
            select: { id: true, name: true, email: true, avatarUrl: true, designation: true, role: true },
          },
        },
      },
      activityLogs: {
        orderBy: { createdAt: "desc" },
        take: 25,
        include: {
          actor: {
            select: { id: true, name: true, email: true, avatarUrl: true, designation: true, role: true },
          },
        },
      },
      _count: { select: { subtasks: true, comments: true, attachments: true } },
    },
  });

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const hasAccess = await canAccessProject(user, task.projectId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ data: task });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json();
  const result = await updateTaskAction({ ...body, id });
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result);
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const result = await deleteTaskAction(id);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result);
}
