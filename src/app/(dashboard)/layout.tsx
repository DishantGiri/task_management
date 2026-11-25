import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/permissions";
import { getWorkspaceReferenceData } from "@/lib/queries";
import { AppShell } from "@/components/layout/app-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login?reauth=1");
  }

  // Place account on hold if not yet approved / active
  if (user.status !== "ACTIVE") {
    redirect("/pending-approval");
  }

  const [refData, unreadCount, pinnedNotes] = await Promise.all([
    getWorkspaceReferenceData(user),
    prisma.notification.count({
      where: { userId: user.id, isRead: false },
    }),
    prisma.personalNote.findMany({
      where: { userId: user.id, isPinned: true },
      orderBy: { updatedAt: "desc" },
      take: 6,
      select: { id: true, title: true },
    }),
  ]);

  return (
    <AppShell
      user={user}
      initialUnreadCount={unreadCount}
      projects={refData.projects}
      pinnedNotes={pinnedNotes}
      users={refData.users}
      tags={refData.tags}
    >
      {children}
    </AppShell>
  );
}
