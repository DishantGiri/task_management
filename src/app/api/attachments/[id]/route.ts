import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { canAccessProject, getCurrentUser } from "@/lib/permissions";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const attachment = await prisma.attachment.findUnique({
    where: { id },
    include: { task: { select: { projectId: true } } },
  });

  if (!attachment) {
    return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
  }

  const hasAccess = await canAccessProject(user, attachment.task.projectId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const resolvedPath = path.resolve(process.cwd(), attachment.storagePath);
    const uploadsRoot = path.resolve(process.cwd(), "uploads");
    if (!resolvedPath.startsWith(uploadsRoot)) {
      return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
    }

    const fileBytes = await readFile(resolvedPath);
    const safeDownloadName = attachment.fileName.replace(/["\r\n]/g, "");

    return new NextResponse(fileBytes, {
      status: 200,
      headers: {
        "Content-Type": attachment.mimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${safeDownloadName}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found on disk" }, { status: 404 });
  }
}
