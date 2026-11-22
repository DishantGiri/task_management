import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { canAccessProject, getCurrentUser } from "@/lib/permissions";

function isSafeInlinePreview(mimeType: string): boolean {
  const m = (mimeType || "").toLowerCase();
  if (m.startsWith("image/") && !m.includes("svg")) return true;
  if (m === "application/pdf") return true;
  if (m.startsWith("video/") || m.startsWith("audio/")) return true;
  if (m === "text/plain" || m === "text/csv" || m === "application/json")
    return true;
  return false;
}

export async function GET(
  request: NextRequest,
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
    const contentType = attachment.mimeType || "application/octet-stream";
    const wantsPreview = request.nextUrl.searchParams.get("preview") === "1";
    const disposition =
      wantsPreview && isSafeInlinePreview(contentType) ? "inline" : "attachment";

    return new NextResponse(fileBytes, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `${disposition}; filename="${safeDownloadName}"`,
        "X-Content-Type-Options": "nosniff",
        ...(wantsPreview
          ? { "Cache-Control": "private, max-age=300" }
          : {}),
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found on disk" }, { status: 404 });
  }
}
