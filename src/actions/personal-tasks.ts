"use server";

import { revalidatePath } from "next/cache";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { invalidatePersonalTasksCache } from "@/lib/cache/redis";
import { requireAuth } from "@/lib/permissions";
import {
  personalTaskCreateSchema,
  personalTaskUpdateSchema,
} from "@/lib/validations";
import type { PersonalChecklistItem } from "@/types";
import type { Prisma } from "@prisma/client";

function parseChecklist(raw: unknown): PersonalChecklistItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (item): item is PersonalChecklistItem =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as PersonalChecklistItem).id === "string" &&
        typeof (item as PersonalChecklistItem).title === "string"
    )
    .map((item) => ({
      id: item.id,
      title: item.title,
      completed: Boolean(item.completed),
    }));
}

async function revalidatePersonalViews(userId: string) {
  await invalidatePersonalTasksCache(userId);
  revalidatePath("/personal-tasks");
  revalidatePath("/my-tasks");
  revalidatePath("/dashboard");
}

export async function createPersonalTaskAction(values: unknown) {
  try {
    const user = await requireAuth();
    const parsed = personalTaskCreateSchema.safeParse(values);
    if (!parsed.success) {
      return {
        error: parsed.error.errors[0]?.message || "Invalid personal task",
      };
    }

    const data = parsed.data;
    const created = await prisma.personalTask.create({
      data: {
        title: data.title.trim(),
        notes: data.notes?.trim() || null,
        status: data.status,
        priority: data.priority,
        category: data.category.trim() || "General",
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        isPinned: data.isPinned,
        checklist: data.checklist as unknown as Prisma.InputJsonValue,
        completedAt: data.status === "DONE" ? new Date() : null,
        userId: user.id,
      },
    });

    await revalidatePersonalViews(user.id);
    return {
      success: true,
      task: {
        ...created,
        checklist: parseChecklist(created.checklist),
        dueDate: created.dueDate?.toISOString() ?? null,
        completedAt: created.completedAt?.toISOString() ?? null,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      },
    };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Failed to create personal task",
    };
  }
}

export async function updatePersonalTaskAction(values: unknown) {
  try {
    const user = await requireAuth();
    const parsed = personalTaskUpdateSchema.safeParse(values);
    if (!parsed.success) {
      return {
        error: parsed.error.errors[0]?.message || "Invalid personal task update",
      };
    }

    const data = parsed.data;
    const existing = await prisma.personalTask.findFirst({
      where: { id: data.id, userId: user.id },
    });
    if (!existing) {
      return { error: "Personal task not found." };
    }

    const updatePayload: Prisma.PersonalTaskUpdateInput = {};
    if (data.title !== undefined) updatePayload.title = data.title.trim();
    if (data.notes !== undefined)
      updatePayload.notes = data.notes?.trim() || null;
    if (data.status !== undefined) {
      updatePayload.status = data.status;
      updatePayload.completedAt = data.status === "DONE" ? new Date() : null;
    }
    if (data.priority !== undefined) updatePayload.priority = data.priority;
    if (data.category !== undefined)
      updatePayload.category = data.category.trim() || "General";
    if (data.dueDate !== undefined) {
      updatePayload.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    }
    if (data.isPinned !== undefined) updatePayload.isPinned = data.isPinned;
    if (data.checklist !== undefined) {
      updatePayload.checklist =
        data.checklist as unknown as Prisma.InputJsonValue;
    }

    const updated = await prisma.personalTask.update({
      where: { id: existing.id },
      data: updatePayload,
    });

    await revalidatePersonalViews(user.id);
    return {
      success: true,
      task: {
        ...updated,
        checklist: parseChecklist(updated.checklist),
        dueDate: updated.dueDate?.toISOString() ?? null,
        completedAt: updated.completedAt?.toISOString() ?? null,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    };
  } catch {
    return { error: "Failed to update personal task." };
  }
}

export async function addPersonalChecklistItemAction(
  taskId: string,
  itemTitle: string
) {
  try {
    const user = await requireAuth();
    const clean = itemTitle.trim();
    if (!clean) return { error: "Checklist item cannot be empty." };

    const existing = await prisma.personalTask.findFirst({
      where: { id: taskId, userId: user.id },
    });
    if (!existing) return { error: "Personal task not found." };

    const checklist = parseChecklist(existing.checklist);
    const nextChecklist: PersonalChecklistItem[] = [
      ...checklist,
      { id: crypto.randomUUID(), title: clean, completed: false },
    ];

    await prisma.personalTask.update({
      where: { id: existing.id },
      data: {
        checklist: nextChecklist as unknown as Prisma.InputJsonValue,
      },
    });

    await revalidatePersonalViews(user.id);
    return { success: true, checklist: nextChecklist };
  } catch {
    return { error: "Failed to add checklist item." };
  }
}

export async function togglePersonalChecklistItemAction(
  taskId: string,
  itemId: string
) {
  try {
    const user = await requireAuth();
    const existing = await prisma.personalTask.findFirst({
      where: { id: taskId, userId: user.id },
    });
    if (!existing) return { error: "Personal task not found." };

    const checklist = parseChecklist(existing.checklist);
    const nextChecklist = checklist.map((item) =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );

    await prisma.personalTask.update({
      where: { id: existing.id },
      data: {
        checklist: nextChecklist as unknown as Prisma.InputJsonValue,
      },
    });

    await revalidatePersonalViews(user.id);
    return { success: true, checklist: nextChecklist };
  } catch {
    return { error: "Failed to update checklist item." };
  }
}

export async function removePersonalChecklistItemAction(
  taskId: string,
  itemId: string
) {
  try {
    const user = await requireAuth();
    const existing = await prisma.personalTask.findFirst({
      where: { id: taskId, userId: user.id },
    });
    if (!existing) return { error: "Personal task not found." };

    const checklist = parseChecklist(existing.checklist);
    const nextChecklist = checklist.filter((item) => item.id !== itemId);

    await prisma.personalTask.update({
      where: { id: existing.id },
      data: {
        checklist: nextChecklist as unknown as Prisma.InputJsonValue,
      },
    });

    await revalidatePersonalViews(user.id);
    return { success: true, checklist: nextChecklist };
  } catch {
    return { error: "Failed to remove checklist item." };
  }
}

export async function deletePersonalTaskAction(taskId: string) {
  try {
    const user = await requireAuth();
    const existing = await prisma.personalTask.findFirst({
      where: { id: taskId, userId: user.id },
    });
    if (!existing) return { error: "Personal task not found." };

    await prisma.personalTask.delete({ where: { id: existing.id } });
    await revalidatePersonalViews(user.id);
    return { success: true };
  } catch {
    return { error: "Failed to delete personal task." };
  }
}

export async function clearCompletedPersonalTasksAction() {
  try {
    const user = await requireAuth();
    await prisma.personalTask.deleteMany({
      where: { userId: user.id, status: "DONE" },
    });
    await revalidatePersonalViews(user.id);
    return { success: true };
  } catch {
    return { error: "Failed to clear completed personal tasks." };
  }
}
