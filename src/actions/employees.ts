"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  createActivityLog,
  requireAuth,
  requireRole,
} from "@/lib/permissions";
import {
  departmentCreateSchema,
  employeeCreateSchema,
  employeeUpdateSchema,
  passwordChangeSchema,
  profileUpdateSchema,
  tagCreateSchema,
} from "@/lib/validations";

export async function createEmployeeAction(values: unknown) {
  try {
    const actor = await requireRole(["ADMIN"]);
    const parsed = employeeCreateSchema.safeParse(values);
    if (!parsed.success) {
      return { error: parsed.error.errors[0]?.message || "Invalid employee data" };
    }

    const email = parsed.data.email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return { error: "An employee with this email already exists." };
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);

    const created = await prisma.user.create({
      data: {
        name: parsed.data.name.trim(),
        email,
        passwordHash,
        role: parsed.data.role,
        status: parsed.data.status,
        departmentId: parsed.data.departmentId || null,
        designation: parsed.data.designation?.trim() || null,
        avatarUrl: parsed.data.avatarUrl?.trim() || null,
      },
    });

    await createActivityLog({
      action: "USER_CREATED",
      entityType: "USER",
      entityId: created.id,
      description: `added ${created.name} (${created.role}) to the organization`,
      actorId: actor.id,
    });

    revalidatePath("/team");
    revalidatePath("/dashboard");
    return { success: true, id: created.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create employee";
    if (message === "FORBIDDEN") return { error: "Only Admins can invite or create employees." };
    return { error: message };
  }
}

export async function updateEmployeeAction(values: unknown) {
  try {
    const actor = await requireRole(["ADMIN"]);
    const parsed = employeeUpdateSchema.safeParse(values);
    if (!parsed.success) {
      return { error: parsed.error.errors[0]?.message || "Invalid employee data" };
    }

    const email = parsed.data.email.toLowerCase().trim();
    const conflict = await prisma.user.findFirst({
      where: { email, id: { not: parsed.data.id } },
    });
    if (conflict) {
      return { error: "Another employee already uses this email address." };
    }

    if (parsed.data.id === actor.id && parsed.data.status === "INACTIVE") {
      return { error: "You cannot deactivate your own admin account." };
    }

    const data: Record<string, unknown> = {
      name: parsed.data.name.trim(),
      email,
      role: parsed.data.role,
      status: parsed.data.status,
      departmentId: parsed.data.departmentId || null,
      designation: parsed.data.designation?.trim() || null,
      avatarUrl: parsed.data.avatarUrl?.trim() || null,
    };

    if (parsed.data.password && parsed.data.password.length >= 8) {
      data.passwordHash = await bcrypt.hash(parsed.data.password, 12);
    }

    const updated = await prisma.user.update({
      where: { id: parsed.data.id },
      data,
    });

    await createActivityLog({
      action: "USER_UPDATED",
      entityType: "USER",
      entityId: updated.id,
      description: `updated profile and permissions for ${updated.name}`,
      actorId: actor.id,
    });

    revalidatePath("/team");
    revalidatePath("/dashboard");
    revalidatePath("/reports");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update employee";
    if (message === "FORBIDDEN") return { error: "Only Admins can update employees." };
    return { error: message };
  }
}

export async function toggleEmployeeStatusAction(userId: string) {
  try {
    const actor = await requireRole(["ADMIN"]);
    if (userId === actor.id) {
      return { error: "You cannot deactivate your own account." };
    }

    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) return { error: "Employee not found." };

    const nextStatus = target.status === "INACTIVE" ? "ACTIVE" : "INACTIVE";
    await prisma.user.update({
      where: { id: userId },
      data: { status: nextStatus },
    });

    await createActivityLog({
      action: "USER_STATUS_CHANGED",
      entityType: "USER",
      entityId: userId,
      description: `${nextStatus === "INACTIVE" ? "deactivated" : "reactivated"} ${target.name}'s account`,
      actorId: actor.id,
    });

    revalidatePath("/team");
    revalidatePath("/dashboard");
    return { success: true, status: nextStatus };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Action failed";
    if (message === "FORBIDDEN") return { error: "Only Admins can change account status." };
    return { error: message };
  }
}

export async function createDepartmentAction(values: unknown) {
  try {
    await requireRole(["ADMIN"]);
    const parsed = departmentCreateSchema.safeParse(values);
    if (!parsed.success) {
      return { error: parsed.error.errors[0]?.message || "Invalid department" };
    }

    const existing = await prisma.department.findUnique({
      where: { name: parsed.data.name.trim() },
    });
    if (existing) return { error: "Department already exists." };

    await prisma.department.create({
      data: {
        name: parsed.data.name.trim(),
        description: parsed.data.description?.trim() || null,
      },
    });

    revalidatePath("/settings");
    revalidatePath("/team");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create department";
    if (message === "FORBIDDEN") return { error: "Only Admins can manage departments." };
    return { error: message };
  }
}

export async function deleteDepartmentAction(id: string) {
  try {
    await requireRole(["ADMIN"]);
    await prisma.department.delete({ where: { id } });
    revalidatePath("/settings");
    revalidatePath("/team");
    return { success: true };
  } catch {
    return { error: "Failed to delete department." };
  }
}

export async function createTagAction(values: unknown) {
  try {
    await requireRole(["ADMIN", "MANAGER"]);
    const parsed = tagCreateSchema.safeParse(values);
    if (!parsed.success) {
      return { error: parsed.error.errors[0]?.message || "Invalid tag" };
    }

    const existing = await prisma.tag.findUnique({
      where: { name: parsed.data.name.trim() },
    });
    if (existing) return { error: "A tag with this name already exists." };

    await prisma.tag.create({
      data: {
        name: parsed.data.name.trim(),
        color: parsed.data.color,
      },
    });

    revalidatePath("/settings");
    revalidatePath("/tasks");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create tag";
    if (message === "FORBIDDEN") return { error: "Insufficient permissions." };
    return { error: message };
  }
}

export async function deleteTagAction(id: string) {
  try {
    await requireRole(["ADMIN", "MANAGER"]);
    await prisma.tag.delete({ where: { id } });
    revalidatePath("/settings");
    revalidatePath("/tasks");
    return { success: true };
  } catch {
    return { error: "Failed to delete tag." };
  }
}

export async function updateProfileAction(values: unknown) {
  try {
    const user = await requireAuth();
    const parsed = profileUpdateSchema.safeParse(values);
    if (!parsed.success) {
      return { error: parsed.error.errors[0]?.message || "Invalid profile data" };
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        name: parsed.data.name.trim(),
        designation: parsed.data.designation?.trim() || null,
        avatarUrl: parsed.data.avatarUrl?.trim() || null,
      },
    });

    revalidatePath("/settings");
    revalidatePath("/dashboard");
    revalidatePath("/team");
    return { success: true };
  } catch {
    return { error: "Failed to update profile." };
  }
}

export async function changePasswordAction(values: unknown) {
  try {
    const user = await requireAuth();
    const parsed = passwordChangeSchema.safeParse(values);
    if (!parsed.success) {
      return { error: parsed.error.errors[0]?.message || "Invalid password input" };
    }

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (!dbUser) return { error: "Account not found." };

    const valid = await bcrypt.compare(
      parsed.data.currentPassword,
      dbUser.passwordHash
    );
    if (!valid) return { error: "Current password is incorrect." };

    const newHash = await bcrypt.hash(parsed.data.newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });

    return { success: true };
  } catch {
    return { error: "Failed to update password." };
  }
}
