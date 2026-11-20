"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { invalidateWorkspaceCache } from "@/lib/cache/redis";
import {
  canManageProject,
  createActivityLog,
  createNotification,
  requireAuth,
  requireRole,
} from "@/lib/permissions";
import { projectCreateSchema, projectUpdateSchema } from "@/lib/validations";
import type { ProjectMemberRole } from "@prisma/client";

export async function createProjectAction(values: unknown) {
  try {
    const user = await requireRole(["ADMIN", "MANAGER"]);
    const parsed = projectCreateSchema.safeParse(values);
    if (!parsed.success) {
      return { error: parsed.error.errors[0]?.message || "Invalid project data" };
    }

    const existingCode = await prisma.project.findUnique({
      where: { code: parsed.data.code },
    });
    if (existingCode) {
      return { error: `Project code "${parsed.data.code}" is already in use.` };
    }

    const managerId =
      user.role === "ADMIN" ? parsed.data.managerId : user.id;

    const uniqueMemberIds = Array.from(
      new Set([...parsed.data.memberIds, managerId])
    );

    const project = await prisma.project.create({
      data: {
        name: parsed.data.name.trim(),
        code: parsed.data.code,
        description: parsed.data.description?.trim() || null,
        color: parsed.data.color,
        status: parsed.data.status,
        priority: parsed.data.priority,
        managerId,
        startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
        endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
        members: {
          create: uniqueMemberIds.map((uid) => ({
            userId: uid,
            role: uid === managerId ? "LEAD" : "MEMBER",
          })),
        },
      },
    });

    await createActivityLog({
      action: "PROJECT_CREATED",
      entityType: "PROJECT",
      entityId: project.id,
      description: `created project ${project.name} (${project.code})`,
      actorId: user.id,
      projectId: project.id,
    });

    for (const memberId of uniqueMemberIds) {
      await createNotification({
        userId: memberId,
        actorId: user.id,
        type: "PROJECT_ADDED",
        title: `Added to ${project.name}`,
        message: `${user.name} added you to project ${project.name} (${project.code}).`,
        link: `/projects/${project.id}`,
      });
    }

    await invalidateWorkspaceCache();
    revalidatePath("/projects");
    revalidatePath("/dashboard");
    return { success: true, id: project.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create project";
    if (message === "FORBIDDEN") return { error: "Only Admins and Managers can create projects." };
    return { error: message };
  }
}

export async function updateProjectAction(values: unknown) {
  try {
    const user = await requireAuth();
    const parsed = projectUpdateSchema.safeParse(values);
    if (!parsed.success) {
      return { error: parsed.error.errors[0]?.message || "Invalid project data" };
    }

    const allowed = await canManageProject(user, parsed.data.id);
    if (!allowed) {
      return { error: "You do not have permission to edit this project." };
    }

    const codeConflict = await prisma.project.findFirst({
      where: { code: parsed.data.code, id: { not: parsed.data.id } },
    });
    if (codeConflict) {
      return { error: `Project code "${parsed.data.code}" is already in use.` };
    }

    const existing = await prisma.project.findUnique({
      where: { id: parsed.data.id },
      select: { managerId: true },
    });
    if (!existing) return { error: "Project not found." };

    const managerId =
      user.role === "ADMIN" ? parsed.data.managerId : existing.managerId;

    await prisma.project.update({
      where: { id: parsed.data.id },
      data: {
        name: parsed.data.name.trim(),
        code: parsed.data.code,
        description: parsed.data.description?.trim() || null,
        color: parsed.data.color,
        status: parsed.data.status,
        priority: parsed.data.priority,
        managerId,
        startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
        endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
      },
    });

    // Ensure manager is a LEAD member
    await prisma.projectMember.upsert({
      where: {
        projectId_userId: {
          projectId: parsed.data.id,
          userId: managerId,
        },
      },
      update: { role: "LEAD" },
      create: { projectId: parsed.data.id, userId: managerId, role: "LEAD" },
    });

    await createActivityLog({
      action: "PROJECT_UPDATED",
      entityType: "PROJECT",
      entityId: parsed.data.id,
      description: `updated project settings for ${parsed.data.name}`,
      actorId: user.id,
      projectId: parsed.data.id,
    });

    await invalidateWorkspaceCache();
    revalidatePath("/projects");
    revalidatePath(`/projects/${parsed.data.id}`);
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update project";
    return { error: message };
  }
}

export async function deleteProjectAction(projectId: string) {
  try {
    const user = await requireAuth();
    const allowed = await canManageProject(user, projectId);
    if (!allowed) {
      return { error: "You do not have permission to delete this project." };
    }

    await prisma.project.delete({ where: { id: projectId } });
    await invalidateWorkspaceCache();
    revalidatePath("/projects");
    revalidatePath("/dashboard");
    revalidatePath("/tasks");
    return { success: true };
  } catch {
    return { error: "Failed to delete project." };
  }
}

export async function addProjectMemberAction(
  projectId: string,
  userId: string,
  role: ProjectMemberRole = "MEMBER"
) {
  try {
    const actor = await requireAuth();
    const allowed = await canManageProject(actor, projectId);
    if (!allowed) {
      return { error: "You do not have permission to manage project members." };
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { name: true, code: true },
    });
    if (!project) return { error: "Project not found." };

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });
    if (!target) return { error: "Employee not found." };

    await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId, userId } },
      update: { role },
      create: { projectId, userId, role },
    });

    await createActivityLog({
      action: "MEMBER_ADDED",
      entityType: "PROJECT",
      entityId: projectId,
      description: `added ${target.name} to ${project.name}`,
      actorId: actor.id,
      projectId,
    });

    await createNotification({
      userId,
      actorId: actor.id,
      type: "PROJECT_ADDED",
      title: `Added to ${project.name}`,
      message: `${actor.name} added you to ${project.name} (${project.code}) as ${role.toLowerCase()}.`,
      link: `/projects/${projectId}`,
    });

    revalidatePath(`/projects/${projectId}`);
    await invalidateWorkspaceCache();
    revalidatePath("/projects");
    return { success: true };
  } catch {
    return { error: "Failed to add project member." };
  }
}

export async function removeProjectMemberAction(
  projectId: string,
  userId: string
) {
  try {
    const actor = await requireAuth();
    const allowed = await canManageProject(actor, projectId);
    if (!allowed) {
      return { error: "You do not have permission to manage project members." };
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { managerId: true, name: true },
    });
    if (!project) return { error: "Project not found." };
    if (project.managerId === userId) {
      return { error: "Cannot remove the project manager. Reassign manager first." };
    }

    await prisma.projectMember.delete({
      where: { projectId_userId: { projectId, userId } },
    });

    revalidatePath(`/projects/${projectId}`);
    await invalidateWorkspaceCache();
    revalidatePath("/projects");
    return { success: true };
  } catch {
    return { error: "Failed to remove project member." };
  }
}
