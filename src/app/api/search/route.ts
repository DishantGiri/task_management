import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAccessibleProjectIds, getCurrentUser } from "@/lib/permissions";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = new URL(request.url).searchParams.get("q")?.trim() || "";
  if (q.length < 2) {
    return NextResponse.json({ tasks: [], projects: [], people: [] });
  }

  const accessibleProjectIds = await getAccessibleProjectIds(user);

  const [tasks, projects, people] = await Promise.all([
    prisma.task.findMany({
      where: {
        ...(accessibleProjectIds !== null
          ? { projectId: { in: accessibleProjectIds } }
          : {}),
        OR: [{ title: { contains: q } }, { taskKey: { contains: q } }],
      },
      take: 6,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        taskKey: true,
        title: true,
        status: true,
        priority: true,
        project: { select: { name: true, color: true } },
      },
    }),
    prisma.project.findMany({
      where: {
        ...(accessibleProjectIds !== null
          ? { id: { in: accessibleProjectIds } }
          : {}),
        OR: [{ name: { contains: q } }, { code: { contains: q } }],
      },
      take: 5,
      select: { id: true, code: true, name: true, color: true, status: true },
    }),
    prisma.user.findMany({
      where: {
        status: { not: "INACTIVE" },
        OR: [
          { name: { contains: q } },
          { email: { contains: q } },
          { designation: { contains: q } },
        ],
      },
      take: 5,
      select: {
        id: true,
        name: true,
        email: true,
        designation: true,
        role: true,
        avatarUrl: true,
      },
    }),
  ]);

  return NextResponse.json({ tasks, projects, people });
}
