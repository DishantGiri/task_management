import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import {
  canAccessProject,
  createActivityLog,
  getCurrentUser,
} from "@/lib/permissions";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const BLOCKED_EXTENSIONS = new Set([
  ".exe",
  ".sh",
  ".bat",
  ".cmd",
  ".msi",
  ".dll",
  ".js",
  ".mjs",
  ".cjs",
  ".php",
  ".html",
  ".htm",
]);

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const taskId = formData.get("taskId") as string | null;

    if (!file || !taskId) {
      return NextResponse.json(
        { error: "File and taskId are required" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds 10MB limit" },
        { status: 400 }
      );
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, taskKey: true, title: true, projectId: true, parentId: true },
    });
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const hasAccess = await canAccessProject(user, task.projectId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const ext = path.extname(file.name).toLowerCase();
    if (BLOCKED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { error: "This file type is not permitted for security reasons." },
        { status: 400 }
      );
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniqueName = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}-${safeName}`;
    const uploadsDir = path.join(process.cwd(), "uploads");
    await mkdir(uploadsDir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    const storagePath = path.join("uploads", uniqueName);
    await writeFile(path.join(process.cwd(), storagePath), buffer);

    const attachment = await prisma.attachment.create({
      data: {
        fileName: file.name,
        fileUrl: "",
        storagePath,
        mimeType: file.type || "application/octet-stream",
        fileSize: file.size,
        taskId: task.id,
        uploadedById: user.id,
      },
      include: {
        uploadedBy: {
          select: { id: true, name: true, email: true, avatarUrl: true, designation: true, role: true },
        },
      },
    });

    const updated = await prisma.attachment.update({
      where: { id: attachment.id },
      data: { fileUrl: `/api/attachments/${attachment.id}` },
      include: {
        uploadedBy: {
          select: { id: true, name: true, email: true, avatarUrl: true, designation: true, role: true },
        },
      },
    });

    await createActivityLog({
      action: "ATTACHMENT_UPLOADED",
      entityType: "TASK",
      entityId: task.id,
      description: `attached "${file.name}" to ${task.taskKey}`,
      actorId: user.id,
      projectId: task.projectId,
      taskId: task.parentId || task.id,
    });

    return NextResponse.json({ data: updated }, { status: 201 });
  } catch (err) {
    console.error("Attachment upload error:", err);
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }
}
