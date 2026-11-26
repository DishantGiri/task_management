"use server";

import { revalidatePath } from "next/cache";
import { unlink } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import {
  canUserMarkTaskComplete,
  isQaOrTester,
  validateTaskStatusTransition,
} from "@/lib/utils";
import { invalidateWorkspaceCache } from "@/lib/cache/redis";
import {
  canCreateTaskInProject,
  canEditTask,
  createActivityLog,
  createNotification,
  generateNextTaskKey,
  recalculateParentProgress,
  requireAuth,
} from "@/lib/permissions";
import {
  commentCreateSchema,
  taskCreateSchema,
  taskUpdateSchema,
} from "@/lib/validations";
import type { TaskStatus } from "@prisma/client";
import type { TaskListItem } from "@/types";

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

function formatTaskActionError(err: unknown, fallback: string): string {
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code?: unknown }).code)
      : "";
  const raw = err instanceof Error ? err.message : "";

  if (code === "P2000" || raw.includes("too long for the column")) {
    if (raw.toLowerCase().includes("title")) {
      return "Title is too long. Please keep it within 200 characters.";
    }
    return "One of the fields is too long. Please shorten your input and try again.";
  }
  if (code === "P2002") {
    return "A duplicate record already exists. Please try again.";
  }
  if (code === "P2025") {
    return "The requested task could not be found.";
  }
  if (raw.includes("Invalid `prisma.") || raw.includes("PrismaClient")) {
    return fallback;
  }
  return raw || fallback;
}

export async function createTaskAction(values: unknown) {
  try {
    const user = await requireAuth();
    const parsed = taskCreateSchema.safeParse(values);
    if (!parsed.success) {
      return { error: parsed.error.errors[0]?.message || "Invalid task data" };
    }

    const data = parsed.data;

    // Validate parent ticket hierarchy & non-archived project for subtasks
    if (data.parentId) {
      const parentTicket = await prisma.task.findUnique({
        where: { id: data.parentId },
        select: {
          id: true,
          projectId: true,
          parentId: true,
          project: { select: { status: true } },
        },
      });
      if (!parentTicket) {
        return { error: "Parent ticket not found." };
      }
      if (parentTicket.projectId !== data.projectId) {
        return { error: "Subtask must belong to the same project as its parent ticket." };
      }
      if (parentTicket.parentId) {
        return { error: "Nested subtasks are not allowed. Subtasks can only belong to a parent ticket." };
      }
      if (parentTicket.project.status === "ARCHIVED") {
        return { error: "Cannot add subtasks to a ticket in an archived project." };
      }
    }

    // Parallelize permission check, task key generation, and max position query!
    const [allowed, taskKey, maxPos] = await Promise.all([
      canCreateTaskInProject(user, data.projectId, data.parentId),
      generateNextTaskKey(data.projectId),
      prisma.task.aggregate({
        where: {
          projectId: data.projectId,
          status: data.status,
          parentId: data.parentId || null,
        },
        _max: { position: true },
      }),
    ]);

    if (!allowed) {
      return {
        error: data.parentId
          ? "You can only create subtasks on tasks assigned to you."
          : "You do not have permission to create tasks in this project.",
      };
    }

    const initialProgress =
      data.status === "DONE"
        ? 100
        : data.status === "IN_REVIEW"
        ? 75
        : data.status === "IN_PROGRESS"
        ? 40
        : 0;

    const collaboratorIds = Array.from(
      new Set(data.collaboratorIds.filter((id) => id && id !== data.assigneeId))
    );

    const task = await prisma.task.create({
      data: {
        taskKey,
        title: data.title.trim(),
        description: data.description?.trim() || null,
        projectId: data.projectId,
        parentId: data.parentId || null,
        status: data.status,
        priority: data.priority,
        position: (maxPos._max.position ?? -1) + 1,
        progress: initialProgress,
        startDate: data.startDate ? new Date(data.startDate) : null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        completedAt: data.status === "DONE" ? new Date() : null,
        assigneeId: data.assigneeId || null,
        creatorId: user.id,
        collaborators: {
          create: collaboratorIds.map((userId) => ({ userId })),
        },
        tags: {
          create: Array.from(new Set(data.tagIds)).map((tagId) => ({ tagId })),
        },
        dependencies: {
          create: Array.from(new Set(data.dependencyIds)).map((dependsOnId) => ({
            dependsOnId,
          })),
        },
      },
      include: {
        project: { select: { id: true, code: true, name: true, color: true } },
        assignee: { select: userSelect },
        collaborators: { include: { user: { select: userSelect } } },
        tags: {
          include: { tag: { select: { id: true, name: true, color: true } } },
        },
        subtasks: {
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

    await invalidateWorkspaceCache();

    // Run non-blocking side effects (activity logs, notifications, parent progress) in parallel
    void Promise.all([
      data.parentId ? recalculateParentProgress(data.parentId) : Promise.resolve(),
      createActivityLog({
        action: data.parentId ? "SUBTASK_ADDED" : "TASK_CREATED",
        entityType: "TASK",
        entityId: task.id,
        description: data.parentId
          ? `added subtask ${task.taskKey}: ${task.title}`
          : `created task ${task.taskKey}: ${task.title}`,
        actorId: user.id,
        projectId: data.projectId,
        taskId: data.parentId || task.id,
      }),
      task.assigneeId
        ? createNotification({
            userId: task.assigneeId,
            actorId: user.id,
            type: "TASK_ASSIGNED",
            title: `Assigned: ${task.taskKey}`,
            message: `${user.name} assigned you to "${task.title}".`,
            link: `/tasks?taskId=${task.parentId || task.id}`,
            taskId: task.id,
          })
        : Promise.resolve(),
      ...collaboratorIds.map((collabId) =>
        createNotification({
          userId: collabId,
          actorId: user.id,
          type: "TASK_ASSIGNED",
          title: `Collaborator on ${task.taskKey}`,
          message: `${user.name} added you as a collaborator on "${task.title}".`,
          link: `/tasks?taskId=${task.parentId || task.id}`,
          taskId: task.id,
        })
      ),
    ]).catch(() => {});

    revalidatePath("/tasks");
    revalidatePath("/my-tasks");
    revalidatePath("/dashboard");
    revalidatePath("/calendar");
    revalidatePath(`/projects/${data.projectId}`);

    const serializedTask: TaskListItem = {
      ...task,
      startDate: task.startDate?.toISOString() ?? null,
      dueDate: task.dueDate?.toISOString() ?? null,
      completedAt: task.completedAt?.toISOString() ?? null,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      subtasks: task.subtasks.map((s) => ({
        ...s,
        startDate: s.startDate?.toISOString() ?? null,
        dueDate: s.dueDate?.toISOString() ?? null,
      })),
    };

    return {
      success: true,
      id: task.id,
      taskKey: task.taskKey,
      task: serializedTask,
    };
  } catch (err) {
    return { error: formatTaskActionError(err, "Failed to create task. Please try again.") };
  }
}

export async function updateTaskAction(values: unknown) {
  try {
    const user = await requireAuth();
    const parsed = taskUpdateSchema.safeParse(values);
    if (!parsed.success) {
      return { error: parsed.error.errors[0]?.message || "Invalid task update" };
    }

    const data = parsed.data;
    const perm = await canEditTask(user, data.id);
    if (!perm.allowed) {
      return { error: "You do not have permission to update this task." };
    }

    const existing = await prisma.task.findUnique({
      where: { id: data.id },
      include: {
        project: {
          select: {
            managerId: true,
            members: { where: { userId: user.id }, select: { role: true } },
          },
        },
        _count: { select: { subtasks: true } },
        subtasks: { select: { status: true } },
        dependencies: {
          include: {
            dependsOn: { select: { id: true, taskKey: true, status: true } },
          },
        },
      },
    });
    if (!existing) return { error: "Task not found." };

    const isProjectManagerOrLead =
      existing.project.managerId === user.id ||
      existing.project.members.some((m) => m.role === "LEAD");

    const updateData: Record<string, unknown> = {};

    // Employees without fullEdit can update status (and description/title on their own subtasks)
    if (data.status !== undefined) {
      const effectiveAssigneeId =
        perm.fullEdit && data.assigneeId !== undefined
          ? data.assigneeId
          : existing.assigneeId;
      const incompleteSubtasks = existing.subtasks.filter(
        (s) => s.status !== "DONE"
      ).length;
      const incompleteBlockers = existing.dependencies
        .filter((d) => {
          // If the user is also removing this dependency in the same save, don't block on it
          if (perm.fullEdit && data.dependencyIds !== undefined) {
            return (
              data.dependencyIds.includes(d.dependsOn.id) &&
              d.dependsOn.status !== "DONE"
            );
          }
          return d.dependsOn.status !== "DONE";
        })
        .map((d) => d.dependsOn.taskKey);
      const canOverrideBlockers =
        Boolean(data.forceBlockedOverride) &&
        (user.role === "ADMIN" ||
          user.role === "MANAGER" ||
          isProjectManagerOrLead);
      const transitionError = validateTaskStatusTransition({
        currentStatus: existing.status,
        nextStatus: data.status,
        isSubtask: Boolean(existing.parentId),
        totalSubtasks: existing._count.subtasks,
        incompleteSubtasks,
        canMarkComplete:
          canUserMarkTaskComplete(user) || isProjectManagerOrLead,
        hasAssignee: Boolean(effectiveAssigneeId),
        incompleteBlockers: canOverrideBlockers ? [] : incompleteBlockers,
      });
      if (transitionError) {
        return { error: transitionError };
      }

      updateData.status = data.status;
      updateData.completedAt = data.status === "DONE" ? new Date() : null;
      if (data.status === "DONE") {
        updateData.progress = 100;
        // Audit flag: if a non-QA, non-Admin Project Manager / Manager marks a parent ticket Done without QA verification
        const isActorQa = isQaOrTester(user.designation, user.departmentName);
        if (!existing.parentId && user.role !== "ADMIN" && !isActorQa) {
          updateData.qaBypassed = true;
          updateData.qaBypassedAt = new Date();
          updateData.qaBypassedById = user.id;
          updateData.qaBypassReason =
            existing.assigneeId === user.id
              ? "Self-closed by Project Manager without QA / Testing review"
              : "Marked Done by Project Manager without QA / Testing verification";
        } else if (!existing.parentId) {
          updateData.qaBypassed = false;
          updateData.qaBypassedAt = null;
          updateData.qaBypassedById = null;
          updateData.qaBypassReason = null;
        }
      } else {
        // Reopened or moved out of DONE — clear any QA bypass flag
        if (!existing.parentId && existing.qaBypassed) {
          updateData.qaBypassed = false;
          updateData.qaBypassedAt = null;
          updateData.qaBypassedById = null;
          updateData.qaBypassReason = null;
        }
        if (existing._count.subtasks === 0) {
          updateData.progress =
            data.status === "IN_REVIEW"
              ? 75
              : data.status === "IN_PROGRESS"
              ? 40
              : 0;
        } else {
          updateData.progress = Math.min(existing.progress, 90);
        }
      }
    }

    if (perm.fullEdit) {
      if (data.title !== undefined) updateData.title = data.title.trim();
      if (data.description !== undefined)
        updateData.description = data.description?.trim() || null;
      if (data.priority !== undefined) updateData.priority = data.priority;
      if (data.assigneeId !== undefined)
        updateData.assigneeId = data.assigneeId || null;
      if (data.startDate !== undefined)
        updateData.startDate = data.startDate ? new Date(data.startDate) : null;
      if (data.dueDate !== undefined)
        updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
      if (data.position !== undefined) updateData.position = data.position;
    }

    const updated = await prisma.task.update({
      where: { id: data.id },
      data: updateData,
    });

    if (perm.fullEdit && data.collaboratorIds !== undefined) {
      const cleanIds = Array.from(
        new Set(data.collaboratorIds.filter((id) => id && id !== updated.assigneeId))
      );
      await prisma.taskAssignee.deleteMany({ where: { taskId: data.id } });
      if (cleanIds.length > 0) {
        await prisma.taskAssignee.createMany({
          data: cleanIds.map((userId) => ({ taskId: data.id, userId })),
          skipDuplicates: true,
        });
      }
    }

    if (perm.fullEdit && data.tagIds !== undefined) {
      await prisma.taskTag.deleteMany({ where: { taskId: data.id } });
      const uniqueTags = Array.from(new Set(data.tagIds));
      if (uniqueTags.length > 0) {
        await prisma.taskTag.createMany({
          data: uniqueTags.map((tagId) => ({ taskId: data.id, tagId })),
          skipDuplicates: true,
        });
      }
    }

    if (perm.fullEdit && data.dependencyIds !== undefined) {
      await prisma.taskDependency.deleteMany({ where: { taskId: data.id } });
      const uniqueDeps = Array.from(
        new Set(data.dependencyIds.filter((depId) => depId !== data.id))
      );
      if (uniqueDeps.length > 0) {
        await prisma.taskDependency.createMany({
          data: uniqueDeps.map((dependsOnId) => ({
            taskId: data.id,
            dependsOnId,
          })),
          skipDuplicates: true,
        });
      }
    }

    if (data.status !== undefined && existing._count.subtasks > 0) {
      await recalculateParentProgress(data.id);
    }

    if (existing.parentId) {
      const parentProgress = await recalculateParentProgress(existing.parentId);

      // Spec Rule 6: When all subtasks reach DONE (100%), notify Project Manager & Parent Assignee
      // without automatically closing the parent ticket.
      if (
        data.status === "DONE" &&
        existing.status !== "DONE" &&
        parentProgress &&
        parentProgress.totalCount > 0 &&
        parentProgress.progress === 100
      ) {
        const parentTask = await prisma.task.findUnique({
          where: { id: existing.parentId },
          select: {
            id: true,
            taskKey: true,
            title: true,
            status: true,
            assigneeId: true,
            project: {
              select: {
                managerId: true,
                members: {
                  where: { role: "LEAD" },
                  select: { userId: true },
                },
              },
            },
          },
        });

        if (parentTask && parentTask.status !== "DONE") {
          const notifyIds = new Set<string>();
          if (parentTask.project.managerId)
            notifyIds.add(parentTask.project.managerId);
          if (parentTask.assigneeId) notifyIds.add(parentTask.assigneeId);
          for (const lead of parentTask.project.members) {
            notifyIds.add(lead.userId);
          }

          for (const recipientId of notifyIds) {
            if (recipientId !== user.id) {
              await createNotification({
                userId: recipientId,
                actorId: user.id,
                type: "TASK_UPDATED",
                title: `All subtasks complete: ${parentTask.taskKey}`,
                message: `All ${parentProgress.totalCount}/${parentProgress.totalCount} subtasks on "${parentTask.title}" are Done (100%). Ready for final review and closure.`,
                link: `/tasks?taskId=${parentTask.id}`,
                taskId: parentTask.id,
              });
            }
          }
        }
      }
    }

    // Activity & Notifications
    if (data.status && data.status !== existing.status) {
      const labelMap: Record<TaskStatus, string> = {
        TODO: "To Do",
        IN_PROGRESS: "In Progress",
        IN_REVIEW: "In Review",
        DONE: "Done",
      };
      await createActivityLog({
        action: "STATUS_CHANGED",
        entityType: "TASK",
        entityId: updated.id,
        description: `moved ${updated.taskKey} (${updated.title}) to ${labelMap[data.status]}`,
        actorId: user.id,
        projectId: updated.projectId,
        taskId: updated.parentId || updated.id,
      });

      const notifyUserId =
        updated.assigneeId && updated.assigneeId !== user.id
          ? updated.assigneeId
          : updated.creatorId;
      if (notifyUserId && notifyUserId !== user.id) {
        await createNotification({
          userId: notifyUserId,
          actorId: user.id,
          type: "TASK_UPDATED",
          title: `${updated.taskKey} moved to ${labelMap[data.status]}`,
          message: `${user.name} updated "${updated.title}" to ${labelMap[data.status]}.`,
          link: `/tasks?taskId=${updated.parentId || updated.id}`,
          taskId: updated.id,
        });
      }

      // Notify all active Admins whenever a ticket is flagged as forcefully marked Done without QA
      if (updateData.qaBypassed === true) {
        await createActivityLog({
          action: "QA_BYPASS_FLAGGED",
          entityType: "TASK",
          entityId: updated.id,
          description: `forcefully marked ${updated.taskKey} (${updated.title}) Done without QA / Testing verification`,
          actorId: user.id,
          projectId: updated.projectId,
          taskId: updated.id,
        });

        const admins = await prisma.user.findMany({
          where: { role: "ADMIN", status: "ACTIVE", id: { not: user.id } },
          select: { id: true },
        });

        for (const admin of admins) {
          await createNotification({
            userId: admin.id,
            actorId: user.id,
            type: "TASK_UPDATED",
            title: `QA Bypass Flag: ${updated.taskKey}`,
            message: `${user.name} forcefully marked "${updated.title}" Done without QA / Testing review.`,
            link: `/tasks?taskId=${updated.id}`,
            taskId: updated.id,
          });
        }
      }
    }

    if (
      perm.fullEdit &&
      data.assigneeId &&
      data.assigneeId !== existing.assigneeId
    ) {
      await createActivityLog({
        action: "ASSIGNEE_CHANGED",
        entityType: "TASK",
        entityId: updated.id,
        description: `reassigned ${updated.taskKey}: ${updated.title}`,
        actorId: user.id,
        projectId: updated.projectId,
        taskId: updated.parentId || updated.id,
      });

      await createNotification({
        userId: data.assigneeId,
        actorId: user.id,
        type: "TASK_ASSIGNED",
        title: `Assigned: ${updated.taskKey}`,
        message: `${user.name} assigned you to "${updated.title}".`,
        link: `/tasks?taskId=${updated.parentId || updated.id}`,
        taskId: updated.id,
      });
    }

    await invalidateWorkspaceCache();
    revalidatePath("/tasks");
    revalidatePath("/my-tasks");
    revalidatePath("/dashboard");
    revalidatePath("/calendar");
    revalidatePath(`/projects/${updated.projectId}`);
    return { success: true };
  } catch (err) {
    return { error: formatTaskActionError(err, "Failed to update task. Please try again.") };
  }
}

export async function moveTaskKanbanAction(
  taskId: string,
  newStatus: TaskStatus,
  newPosition: number,
  forceBlockedOverride = false
) {
  return updateTaskAction({
    id: taskId,
    status: newStatus,
    position: newPosition,
    forceBlockedOverride,
  });
}

export async function deleteTaskAction(taskId: string) {
  try {
    const user = await requireAuth();
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        taskKey: true,
        title: true,
        status: true,
        projectId: true,
        parentId: true,
        creatorId: true,
        project: {
          select: {
            managerId: true,
            members: { where: { userId: user.id }, select: { role: true } },
          },
        },
      },
    });
    if (!task) return { error: "Task not found." };

    const perm = await canEditTask(user, taskId);
    if (!perm.fullEdit && task.creatorId !== user.id) {
      return { error: "You do not have permission to delete this task." };
    }

    const isProjectManagerOrLead =
      task.project.managerId === user.id ||
      task.project.members.some((m) => m.role === "LEAD");

    // Spec Rule 8: Deleting a DONE subtask requires elevated permission (Admin, Manager, or Project Manager/Lead)
    if (
      task.parentId &&
      task.status === "DONE" &&
      user.role !== "ADMIN" &&
      user.role !== "MANAGER" &&
      !isProjectManagerOrLead
    ) {
      return {
        error: "Only Admins or Project Managers can delete a completed subtask.",
      };
    }

    await prisma.task.delete({ where: { id: taskId } });

    if (task.parentId) {
      await recalculateParentProgress(task.parentId);
    }

    await createActivityLog({
      action: "TASK_DELETED",
      entityType: "PROJECT",
      entityId: task.projectId,
      description: `deleted ${task.taskKey}: ${task.title}`,
      actorId: user.id,
      projectId: task.projectId,
    });

    await invalidateWorkspaceCache();
    revalidatePath("/tasks");
    revalidatePath("/my-tasks");
    revalidatePath("/dashboard");
    revalidatePath("/calendar");
    revalidatePath(`/projects/${task.projectId}`);
    return { success: true };
  } catch {
    return { error: "Failed to delete task." };
  }
}

export async function addTaskCommentAction(values: unknown) {
  try {
    const user = await requireAuth();
    const parsed = commentCreateSchema.safeParse(values);
    if (!parsed.success) {
      return { error: parsed.error.errors[0]?.message || "Invalid comment" };
    }

    const task = await prisma.task.findUnique({
      where: { id: parsed.data.taskId },
      include: {
        collaborators: { select: { userId: true } },
      },
    });
    if (!task) return { error: "Task not found." };

    const comment = await prisma.comment.create({
      data: {
        taskId: task.id,
        authorId: user.id,
        content: parsed.data.content.trim(),
      },
      include: {
        author: {
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
    });

    await createActivityLog({
      action: "COMMENT_ADDED",
      entityType: "TASK",
      entityId: task.id,
      description: `commented on ${task.taskKey}: ${task.title}`,
      actorId: user.id,
      projectId: task.projectId,
      taskId: task.parentId || task.id,
    });

    // Detect @mentions
    const mentionMatches = parsed.data.content.match(/@([A-Za-z][A-Za-z0-9._-]*)/g) || [];
    const mentionedUserIds = new Set<string>();

    if (mentionMatches.length > 0) {
      const allUsers = await prisma.user.findMany({
        where: { status: { not: "INACTIVE" } },
        select: { id: true, name: true, email: true },
      });

      for (const rawMention of mentionMatches) {
        const token = rawMention.slice(1).toLowerCase();
        const match = allUsers.find(
          (u) =>
            u.name.toLowerCase().startsWith(token) ||
            u.name.toLowerCase().replace(/\s+/g, "").includes(token) ||
            u.email.toLowerCase().startsWith(token)
        );
        if (match && match.id !== user.id) {
          mentionedUserIds.add(match.id);
        }
      }
    }

    for (const mentionedId of mentionedUserIds) {
      await createNotification({
        userId: mentionedId,
        actorId: user.id,
        type: "MENTION",
        title: `${user.name} mentioned you in ${task.taskKey}`,
        message: parsed.data.content.slice(0, 140),
        link: `/tasks?taskId=${task.parentId || task.id}`,
        taskId: task.id,
      });
    }

    // Notify assignee and collaborators who weren't already mentioned
    const participants = new Set<string>();
    if (task.assigneeId) participants.add(task.assigneeId);
    if (task.creatorId) participants.add(task.creatorId);
    for (const c of task.collaborators) participants.add(c.userId);

    for (const participantId of participants) {
      if (participantId !== user.id && !mentionedUserIds.has(participantId)) {
        await createNotification({
          userId: participantId,
          actorId: user.id,
          type: "COMMENT_ADDED",
          title: `New comment on ${task.taskKey}`,
          message: `${user.name}: ${parsed.data.content.slice(0, 120)}`,
          link: `/tasks?taskId=${task.parentId || task.id}`,
          taskId: task.id,
        });
      }
    }

    revalidatePath("/tasks");
    revalidatePath(`/projects/${task.projectId}`);
    return {
      success: true,
      comment: {
        ...comment,
        createdAt: comment.createdAt.toISOString(),
      },
    };
  } catch {
    return { error: "Failed to post comment." };
  }
}

export async function deleteAttachmentAction(attachmentId: string) {
  try {
    const user = await requireAuth();
    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: {
        task: {
          select: {
            id: true,
            projectId: true,
            assigneeId: true,
            project: {
              select: {
                managerId: true,
                members: {
                  where: { userId: user.id },
                  select: { role: true },
                },
              },
            },
          },
        },
      },
    });
    if (!attachment) return { error: "Attachment not found." };

    const isAdmin = user.role === "ADMIN";
    const isProjectManager =
      attachment.task.project.managerId === user.id ||
      (user.role === "MANAGER" && attachment.task.project.members.length > 0) ||
      attachment.task.project.members.some((m) => m.role === "LEAD");
    const isAssignedEmployee = attachment.task.assigneeId === user.id;

    if (!isAdmin && !isProjectManager && !isAssignedEmployee) {
      return {
        error:
          "Only the assigned employee, Project Manager, or Admin can delete this attachment.",
      };
    }

    await prisma.attachment.delete({ where: { id: attachmentId } });

    try {
      const fullPath = path.join(process.cwd(), attachment.storagePath);
      await unlink(fullPath);
    } catch {
      // Ignore if file already missing on disk
    }

    await invalidateWorkspaceCache();
    revalidatePath("/tasks");
    revalidatePath(`/projects/${attachment.task.projectId}`);
    return { success: true };
  } catch {
    return { error: "Failed to delete attachment." };
  }
}

export async function resolveQaBypassFlagAction(
  taskId: string,
  resolution: "APPROVE" | "REOPEN_FOR_QA"
) {
  try {
    const user = await requireAuth();
    if (user.role !== "ADMIN") {
      return { error: "Only Admins can resolve QA bypass audit flags." };
    }

    const existing = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        taskKey: true,
        title: true,
        projectId: true,
        assigneeId: true,
        qaBypassedById: true,
        _count: { select: { subtasks: true } },
      },
    });
    if (!existing) return { error: "Task not found." };

    if (resolution === "APPROVE") {
      await prisma.task.update({
        where: { id: taskId },
        data: {
          qaBypassed: false,
          qaBypassedAt: null,
          qaBypassedById: null,
          qaBypassReason: null,
        },
      });

      await createActivityLog({
        action: "QA_BYPASS_APPROVED",
        entityType: "TASK",
        entityId: existing.id,
        description: `reviewed and approved QA bypass flag on ${existing.taskKey}`,
        actorId: user.id,
        projectId: existing.projectId,
        taskId: existing.id,
      });
    } else {
      await prisma.task.update({
        where: { id: taskId },
        data: {
          status: "IN_REVIEW",
          completedAt: null,
          progress: existing._count.subtasks > 0 ? 90 : 75,
          qaBypassed: false,
          qaBypassedAt: null,
          qaBypassedById: null,
          qaBypassReason: null,
        },
      });

      await createActivityLog({
        action: "QA_BYPASS_REOPENED",
        entityType: "TASK",
        entityId: existing.id,
        description: `reopened ${existing.taskKey} back to In Review / QA for proper verification`,
        actorId: user.id,
        projectId: existing.projectId,
        taskId: existing.id,
      });

      const notifyTarget = existing.qaBypassedById || existing.assigneeId;
      if (notifyTarget && notifyTarget !== user.id) {
        await createNotification({
          userId: notifyTarget,
          actorId: user.id,
          type: "TASK_UPDATED",
          title: `Returned to QA: ${existing.taskKey}`,
          message: `${user.name} moved "${existing.title}" back to In Review / QA for proper testing verification.`,
          link: `/tasks?taskId=${existing.id}`,
          taskId: existing.id,
        });
      }
    }

    await invalidateWorkspaceCache();
    revalidatePath("/tasks");
    revalidatePath("/dashboard");
    revalidatePath(`/projects/${existing.projectId}`);
    return { success: true };
  } catch (err) {
    return {
      error: formatTaskActionError(
        err,
        "Failed to resolve QA bypass flag."
      ),
    };
  }
}

export async function markNotificationReadAction(notificationId: string) {
  try {
    const user = await requireAuth();
    await prisma.notification.updateMany({
      where: { id: notificationId, userId: user.id },
      data: { isRead: true },
    });
    revalidatePath("/inbox");
    return { success: true };
  } catch {
    return { error: "Failed to update notification." };
  }
}

export async function markAllNotificationsReadAction() {
  try {
    const user = await requireAuth();
    await prisma.notification.updateMany({
      where: { userId: user.id, isRead: false },
      data: { isRead: true },
    });
    revalidatePath("/inbox");
    return { success: true };
  } catch {
    return { error: "Failed to mark notifications as read." };
  }
}
