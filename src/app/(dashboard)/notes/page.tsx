import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/permissions";
import { PersonalNotesWorkspace } from "@/components/tasks/personal-notes-workspace";
import { Skeleton } from "@/components/ui/skeleton";

export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<{ noteId?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?reauth=1");

  const params = await searchParams;

  const [rawNotes, workspaceUsers] = await Promise.all([
    prisma.personalNote.findMany({
      where: {
        OR: [
          { userId: user.id },
          { shares: { some: { userId: user.id } } },
        ],
      },
      orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
        shares: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
                designation: true,
              },
            },
          },
        },
      },
    }),
    prisma.user.findMany({
      where: { status: "ACTIVE", id: { not: user.id } },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        designation: true,
        department: { select: { id: true, name: true } },
      },
    }),
  ]);

  const initialNotes = rawNotes.map((n) => {
    const isOwner = n.userId === user.id;
    const myShare = n.shares.find((s) => s.userId === user.id);
    return {
      id: n.id,
      title: n.title,
      icon: n.icon,
      content: n.content,
      isPinned: n.isPinned,
      createdAt: n.createdAt.toISOString(),
      updatedAt: n.updatedAt.toISOString(),
      isOwner,
      canEdit: isOwner || Boolean(myShare?.canEdit),
      owner: n.user,
      shares: n.shares.map((s) => ({
        id: s.id,
        userId: s.userId,
        canEdit: s.canEdit,
        user: s.user,
      })),
    };
  });

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-[24px] font-semibold tracking-tight text-[#20232B]">
            Notes
          </h1>
          <span className="inline-flex items-center gap-1 rounded-md border border-[#EAECF0] bg-white px-2 py-0.5 text-[11px] font-medium text-[#737987] shadow-subtle">
            <Lock className="h-3 w-3 text-[#635BDB]" />
            Private &amp; Shared
          </span>
        </div>
        <p className="text-[13px] text-[#737987] mt-0.5">
          Rich Notion-style notes with full-screen editing and optional teammate
          sharing.
        </p>
      </div>

      <Suspense fallback={<Skeleton className="h-[420px] w-full" />}>
        <PersonalNotesWorkspace
          initialNotes={initialNotes}
          shareableUsers={workspaceUsers}
          initialOpenNoteId={params.noteId || null}
        />
      </Suspense>
    </div>
  );
}
