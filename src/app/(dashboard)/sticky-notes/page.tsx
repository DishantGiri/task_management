import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/permissions";
import {
  StickyNotesBoard,
  type StickyColor,
} from "@/components/tasks/sticky-notes-board";

export default async function StickyNotesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?reauth=1");

  const rows = await prisma.stickyNote.findMany({
    where: { userId: user.id },
    orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
  });

  const initialNotes = rows.map((n) => ({
    id: n.id,
    title: n.title,
    content: n.content,
    color: (["amber", "lavender", "mint", "sky", "rose"].includes(n.color)
      ? n.color
      : "amber") as StickyColor,
    isPinned: n.isPinned,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
  }));

  return <StickyNotesBoard initialNotes={initialNotes} />;
}
