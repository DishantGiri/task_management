"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  canManageProject,
  createActivityLog,
  requireAuth,
} from "@/lib/permissions";
import {
  milestoneCreateSchema,
  milestoneUpdateSchema,
} from "@/lib/validations";
import { invalidateWorkspaceCache } from "@/lib/cache/redis";

export async function createMilestoneAction(values: unknown) {
  try {
    const user = await requireAuth();
    const parsed = milestoneCreateSchema.safeParse(values);
    if (!parsed.success) {
      return {
        error: parsed.error.errors[0]?.message || "Invalid milestone details.",
      };
    }

    const data = parsed.data;
    const allowed = await canManageProject(user, data.projectId);
    if (!allowed) {
      return {
        error: "Only Admins or Project Managers can create milestones.",
      };
    }

    const milestone = await prisma.milestone.create({
      data: {
        title: data.title,
        description: data.description?.trim() || null,
        status: data.status,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        projectId: data.projectId,
        createdById: user.id,
      },
    });

    if (data.taskIds.length > 0) {
      await prisma.task.updateMany({
        where: {
          id: { in: data.taskIds },
          projectId: data.projectId,
        },
        data: { milestoneId: milestone.id },
      });
    }

    await createActivityLog({
      action: "MILESTONE_CREATED",
      entityType: "PROJECT",
      entityId: data.projectId,
      description: `created milestone "${milestone.title}"`,
      actorId: user.id,
      projectId: data.projectId,
    });

    await invalidateWorkspaceCache();
    revalidatePath(`/projects/${data.projectId}`);
    return { success: true, id: milestone.id };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Failed to create milestone.",
    };
  }
}

export async function updateMilestoneAction(values: unknown) {
  try {
    const user = await requireAuth();
    const parsed = milestoneUpdateSchema.safeParse(values);
    if (!parsed.success) {
      return {
        error: parsed.error.errors[0]?.message || "Invalid milestone update.",
      };
    }

    const data = parsed.data;
    const existing = await prisma.milestone.findUnique({
      where: { id: data.id },
      select: { id: true, projectId: true, title: true },
    });
    if (!existing) return { error: "Milestone not found." };

    const allowed = await canManageProject(user, existing.projectId);
    if (!allowed) {
      return {
        error: "Only Admins or Project Managers can update milestones.",
      };
    }

    const updateData: Record<string, unknown> = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined)
      updateData.description = data.description?.trim() || null;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.dueDate !== undefined)
      updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;

    await prisma.milestone.update({
      where: { id: data.id },
      data: updateData,
    });

    if (data.taskIds !== undefined) {
      // Detach tasks no longer in this milestone, then attach selected ones
      await prisma.task.updateMany({
        where: {
          milestoneId: data.id,
          id: { notIn: data.taskIds },
        },
        data: { milestoneId: null },
      });
      if (data.taskIds.length > 0) {
        await prisma.task.updateMany({
          where: {
            id: { in: data.taskIds },
            projectId: existing.projectId,
          },
          data: { milestoneId: data.id },
        });
      }
    }

    await invalidateWorkspaceCache();
    revalidatePath(`/projects/${existing.projectId}`);
    return { success: true };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Failed to update milestone.",
    };
  }
}

export async function deleteMilestoneAction(milestoneId: string) {
  try {
    const user = await requireAuth();
    const existing = await prisma.milestone.findUnique({
      where: { id: milestoneId },
      select: { id: true, projectId: true, title: true },
    });
    if (!existing) return { error: "Milestone not found." };

    const allowed = await canManageProject(user, existing.projectId);
    if (!allowed) {
      return {
        error: "Only Admins or Project Managers can delete milestones.",
      };
    }

    await prisma.milestone.delete({ where: { id: milestoneId } });

    await createActivityLog({
      action: "MILESTONE_DELETED",
      entityType: "PROJECT",
      entityId: existing.projectId,
      description: `deleted milestone "${existing.title}"`,
      actorId: user.id,
      projectId: existing.projectId,
    });

    await invalidateWorkspaceCache();
    revalidatePath(`/projects/${existing.projectId}`);
    return { success: true };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Failed to delete milestone.",
    };
  }
}
