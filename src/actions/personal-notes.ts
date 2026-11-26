"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createNotification, requireAuth } from "@/lib/permissions";

const createNoteSchema = z.object({
  title: z.string().max(200).optional(),
  icon: z.string().max(16).optional(),
  content: z.string().max(500000).optional(),
});

const updateNoteSchema = z.object({
  id: z.string().min(1),
  title: z.string().max(200).optional(),
  icon: z.string().max(16).optional(),
  content: z.string().max(500000).optional(),
  isPinned: z.boolean().optional(),
  expectedUpdatedAt: z.string().optional(),
  force: z.boolean().optional(),
});

const shareNoteSchema = z.object({
  noteId: z.string().min(1),
  shares: z.array(
    z.object({
      userId: z.string().min(1),
      canEdit: z.boolean().default(false),
    })
  ),
});

export async function createPersonalNoteAction(values?: unknown) {
  try {
    const user = await requireAuth();
    const parsed = createNoteSchema.safeParse(values || {});
    if (!parsed.success) {
      return { error: "Invalid note data." };
    }

    const note = await prisma.personalNote.create({
      data: {
        userId: user.id,
        title: parsed.data.title?.trim() || "Untitled Note",
        icon: parsed.data.icon || "📝",
        content: parsed.data.content || "",
      },
    });

    revalidatePath("/notes");
    return {
      success: true,
      note: {
        id: note.id,
        title: note.title,
        icon: note.icon,
        content: note.content,
        isPinned: note.isPinned,
        createdAt: note.createdAt.toISOString(),
        updatedAt: note.updatedAt.toISOString(),
        isOwner: true,
        canEdit: true,
        owner: {
          id: user.id,
          name: user.name,
          avatarUrl: user.avatarUrl,
        },
        shares: [],
      },
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to create note.",
    };
  }
}

export async function updatePersonalNoteAction(values: unknown) {
  try {
    const user = await requireAuth();
    const parsed = updateNoteSchema.safeParse(values);
    if (!parsed.success) {
      return { error: "Invalid note update." };
    }

    const data = parsed.data;
    const existing = await prisma.personalNote.findUnique({
      where: { id: data.id },
      include: {
        shares: { where: { userId: user.id }, select: { canEdit: true } },
      },
    });
    if (!existing) return { error: "Note not found." };

    const isOwner = existing.userId === user.id;
    const hasEditShare = existing.shares.some((s) => s.canEdit);
    if (!isOwner && !hasEditShare) {
      return { error: "You do not have permission to edit this note." };
    }

    // Optimistic concurrency conflict guard for simultaneous edits on shared notes
    const isContentUpdate =
      data.title !== undefined || data.content !== undefined;
    if (isContentUpdate && !data.force && data.expectedUpdatedAt) {
      const expectedMs = new Date(data.expectedUpdatedAt).getTime();
      const serverMs = existing.updatedAt.getTime();
      if (!Number.isNaN(expectedMs) && serverMs > expectedMs + 500) {
        const nextTitle =
          data.title !== undefined
            ? data.title.trim() || "Untitled Note"
            : existing.title;
        const nextContent =
          data.content !== undefined ? data.content : existing.content;
        if (nextTitle !== existing.title || nextContent !== existing.content) {
          return {
            conflict: true as const,
            error: "Another collaborator updated this note while you were editing.",
            latestNote: {
              title: existing.title,
              content: existing.content,
              updatedAt: existing.updatedAt.toISOString(),
            },
          };
        }
      }
    }

    const updateData: Record<string, unknown> = {};
    if (data.title !== undefined)
      updateData.title = data.title.trim() || "Untitled Note";
    if (data.icon !== undefined) updateData.icon = data.icon;
    if (data.content !== undefined) updateData.content = data.content;
    if (isOwner && data.isPinned !== undefined)
      updateData.isPinned = data.isPinned;

    const updated = await prisma.personalNote.update({
      where: { id: data.id },
      data: updateData,
    });

    revalidatePath("/notes");
    return {
      success: true,
      updatedAt: updated.updatedAt.toISOString(),
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to save note.",
    };
  }
}

export async function updateNoteSharesAction(values: unknown) {
  try {
    const user = await requireAuth();
    const parsed = shareNoteSchema.safeParse(values);
    if (!parsed.success) {
      return { error: "Invalid share settings." };
    }

    const { noteId, shares } = parsed.data;
    const note = await prisma.personalNote.findFirst({
      where: { id: noteId, userId: user.id },
      include: {
        shares: { select: { userId: true } },
      },
    });
    if (!note) {
      return { error: "Only the note owner can manage sharing." };
    }

    const existingUserIds = new Set(note.shares.map((s) => s.userId));
    const cleanShares = shares.filter((s) => s.userId !== user.id);

    await prisma.$transaction([
      prisma.personalNoteShare.deleteMany({ where: { noteId } }),
      ...(cleanShares.length > 0
        ? [
            prisma.personalNoteShare.createMany({
              data: cleanShares.map((s) => ({
                noteId,
                userId: s.userId,
                canEdit: s.canEdit,
              })),
              skipDuplicates: true,
            }),
          ]
        : []),
    ]);

    // Notify newly added recipients
    const newlyShared = cleanShares.filter(
      (s) => !existingUserIds.has(s.userId)
    );
    await Promise.all(
      newlyShared.map((s) =>
        createNotification({
          userId: s.userId,
          actorId: user.id,
          type: "MENTION",
          title: `Note shared: ${note.title}`,
          message: `${user.name} shared a note with you (${
            s.canEdit ? "Can edit" : "View only"
          }).`,
          link: `/notes?noteId=${note.id}`,
        })
      )
    );

    const updatedShares = await prisma.personalNoteShare.findMany({
      where: { noteId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            designation: true,
          },
        },
      },
    });

    revalidatePath("/notes");
    return {
      success: true,
      shares: updatedShares.map((s) => ({
        id: s.id,
        userId: s.userId,
        canEdit: s.canEdit,
        user: s.user,
      })),
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to update sharing.",
    };
  }
}

export async function deletePersonalNoteAction(noteId: string) {
  try {
    const user = await requireAuth();
    const res = await prisma.personalNote.deleteMany({
      where: { id: noteId, userId: user.id },
    });
    if (res.count === 0)
      return { error: "Only the note owner can delete this note." };

    revalidatePath("/notes");
    return { success: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to delete note.",
    };
  }
}
