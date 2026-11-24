"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  canAccessProject,
  canManageProject,
  createActivityLog,
  createNotification,
  requireAuth,
} from "@/lib/permissions";
import { projectPostCreateSchema } from "@/lib/validations";
import { invalidateWorkspaceCache } from "@/lib/cache/redis";

export async function createProjectPostAction(values: unknown) {
  try {
    const user = await requireAuth();
    const parsed = projectPostCreateSchema.safeParse(values);
    if (!parsed.success) {
      return {
        error: parsed.error.errors[0]?.message || "Invalid post details.",
      };
    }

    const data = parsed.data;
    const hasAccess = await canAccessProject(user, data.projectId);
    if (!hasAccess) {
      return { error: "You do not have access to this project." };
    }

    const canManage = await canManageProject(user, data.projectId);
    if (data.type === "ANNOUNCEMENT" && !canManage) {
      return {
        error: "Only Admins or Project Managers can post announcements.",
      };
    }

    const post = await prisma.projectPost.create({
      data: {
        projectId: data.projectId,
        authorId: user.id,
        type: data.type,
        title: data.title,
        content: data.content,
        isPinned: canManage ? data.isPinned : false,
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            managerId: true,
            members: { select: { userId: true } },
          },
        },
      },
    });

    // Detect @mentions across active users
    const combinedText = `${data.title} ${data.content}`;
    const mentionMatches = Array.from(
      combinedText.matchAll(/@([A-Za-z][A-Za-z0-9._-]*)/g)
    ).map((m) => m[1].toLowerCase());

    const notifiedIds = new Set<string>([user.id]);

    if (mentionMatches.length > 0) {
      const allUsers = await prisma.user.findMany({
        where: { status: "ACTIVE" },
        select: { id: true, name: true, email: true },
      });
      for (const u of allUsers) {
        if (notifiedIds.has(u.id)) continue;
        const first = u.name.split(" ")[0].toLowerCase();
        const emailPrefix = u.email.split("@")[0].toLowerCase();
        const compactName = u.name.replace(/\s+/g, "").toLowerCase();
        if (
          mentionMatches.includes(first) ||
          mentionMatches.includes(emailPrefix) ||
          mentionMatches.includes(compactName)
        ) {
          notifiedIds.add(u.id);
          await createNotification({
            userId: u.id,
            actorId: user.id,
            type: "MENTION",
            title: `Mentioned in ${post.project.name}`,
            message: `${user.name} mentioned you in ${
              data.type === "ANNOUNCEMENT" ? "an announcement" : "a suggestion"
            }: "${data.title}"`,
            link: `/projects/${data.projectId}`,
          });
        }
      }
    }

    // Notify project members for official Announcements
    if (data.type === "ANNOUNCEMENT") {
      const memberIds = Array.from(
        new Set([
          post.project.managerId,
          ...post.project.members.map((m) => m.userId),
        ])
      );
      for (const uid of memberIds) {
        if (notifiedIds.has(uid)) continue;
        notifiedIds.add(uid);
        await createNotification({
          userId: uid,
          actorId: user.id,
          type: "PROJECT_ADDED",
          title: `Announcement: ${post.project.name}`,
          message: `${user.name} posted "${data.title}"`,
          link: `/projects/${data.projectId}`,
        });
      }
    }

    await createActivityLog({
      action:
        data.type === "ANNOUNCEMENT"
          ? "PROJECT_ANNOUNCEMENT"
          : "PROJECT_SUGGESTION",
      entityType: "PROJECT",
      entityId: data.projectId,
      description:
        data.type === "ANNOUNCEMENT"
          ? `posted an announcement: "${data.title}"`
          : `shared a suggestion: "${data.title}"`,
      actorId: user.id,
      projectId: data.projectId,
    });

    await invalidateWorkspaceCache();
    revalidatePath(`/projects/${data.projectId}`);
    return { success: true, id: post.id };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to publish post.",
    };
  }
}

export async function togglePinProjectPostAction(postId: string) {
  try {
    const user = await requireAuth();
    const existing = await prisma.projectPost.findUnique({
      where: { id: postId },
      select: { id: true, projectId: true, isPinned: true },
    });
    if (!existing) return { error: "Post not found." };

    const canManage = await canManageProject(user, existing.projectId);
    if (!canManage) {
      return { error: "Only Admins or Project Managers can pin posts." };
    }

    await prisma.projectPost.update({
      where: { id: postId },
      data: { isPinned: !existing.isPinned },
    });

    revalidatePath(`/projects/${existing.projectId}`);
    return { success: true, isPinned: !existing.isPinned };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to update pin state.",
    };
  }
}

export async function deleteProjectPostAction(postId: string) {
  try {
    const user = await requireAuth();
    const existing = await prisma.projectPost.findUnique({
      where: { id: postId },
      select: { id: true, projectId: true, authorId: true },
    });
    if (!existing) return { error: "Post not found." };

    const canManage = await canManageProject(user, existing.projectId);
    if (!canManage && existing.authorId !== user.id) {
      return { error: "You do not have permission to delete this post." };
    }

    await prisma.projectPost.delete({ where: { id: postId } });
    revalidatePath(`/projects/${existing.projectId}`);
    return { success: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to delete post.",
    };
  }
}
