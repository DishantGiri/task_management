import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/permissions";
import { createPersonalTaskAction } from "@/actions/personal-tasks";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tasks = await prisma.personalTask.findMany({
    where: { userId: user.id },
    orderBy: [
      { isPinned: "desc" },
      { status: "asc" },
      { dueDate: "asc" },
      { updatedAt: "desc" },
    ],
  });

  return NextResponse.json({ data: tasks });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const result = await createPersonalTaskAction(body);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result, { status: 201 });
}
