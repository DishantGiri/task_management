"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/permissions";

const STICKY_COLORS = ["amber", "lavender", "mint", "sky", "rose"] as const;

const createStickySchema = z.object({
  title: z.string().max(120).optional(),
  content: z.string().max(10000).optional(),
  color: z.enum(STICKY_COLORS).default("amber"),
});

const updateStickySchema = z.object({
  id: z.string().min(1),
  title: z.string().max(120).optional(),
  content: z.string().max(10000).optional(),
  color: z.enum(STICKY_COLORS).optional(),
  isPinned: z.boolean().optional(),
});

export async function createStickyNoteAction(values?: unknown) {
  try {
    const user = await requireAuth();
    const parsed = createStickySchema.safeParse(values || {});
    if (!parsed.success) {
      return { error: "Invalid sticky note data." };
    }

    const note = await prisma.stickyNote.create({
      data: {
        userId: user.id,
        title: parsed.data.title?.trim() || "",
        content: parsed.data.content || "",
        color: parsed.data.color,
      },
    });

    revalidatePath("/sticky-notes");
    return {
      success: true,
      note: {
        id: note.id,
        title: note.title,
        content: note.content,
        color: note.color as (typeof STICKY_COLORS)[number],
        isPinned: note.isPinned,
        createdAt: note.createdAt.toISOString(),
        updatedAt: note.updatedAt.toISOString(),
      },
    };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Failed to create sticky note.",
    };
  }
}

export async function updateStickyNoteAction(values: unknown) {
  try {
    const user = await requireAuth();
    const parsed = updateStickySchema.safeParse(values);
    if (!parsed.success) {
      return { error: "Invalid sticky note update." };
    }

    const existing = await prisma.stickyNote.findFirst({
      where: { id: parsed.data.id, userId: user.id },
      select: { id: true },
    });
    if (!existing) {
      return { error: "Sticky note not found." };
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.title !== undefined)
      updateData.title = parsed.data.title.slice(0, 120);
    if (parsed.data.content !== undefined)
      updateData.content = parsed.data.content;
    if (parsed.data.color !== undefined) updateData.color = parsed.data.color;
    if (parsed.data.isPinned !== undefined)
      updateData.isPinned = parsed.data.isPinned;

    const updated = await prisma.stickyNote.update({
      where: { id: existing.id },
      data: updateData,
    });

    revalidatePath("/sticky-notes");
    return {
      success: true,
      updatedAt: updated.updatedAt.toISOString(),
    };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Failed to update sticky note.",
    };
  }
}

export async function deleteStickyNoteAction(id: string) {
  try {
    const user = await requireAuth();
    const existing = await prisma.stickyNote.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });
    if (!existing) {
      return { error: "Sticky note not found." };
    }

    await prisma.stickyNote.delete({ where: { id: existing.id } });
    revalidatePath("/sticky-notes");
    return { success: true };
  } catch {
    return { error: "Failed to delete sticky note." };
  }
}
