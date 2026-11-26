import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/permissions";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const note = await prisma.personalNote.findUnique({
    where: { id },
    include: {
      shares: {
        where: { userId: user.id },
        select: { canEdit: true },
      },
    },
  });

  if (!note) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  const isOwner = note.userId === user.id;
  const myShare = note.shares[0];
  if (!isOwner && !myShare) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(
    {
      id: note.id,
      title: note.title,
      content: note.content,
      updatedAt: note.updatedAt.toISOString(),
      canEdit: isOwner || Boolean(myShare?.canEdit),
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}
