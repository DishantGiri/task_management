import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/permissions";
import { getWorkspaceReferenceData } from "@/lib/queries";
import { AppShell } from "@/components/layout/app-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const [refData, unreadCount] = await Promise.all([
    getWorkspaceReferenceData(user),
    prisma.notification.count({
      where: { userId: user.id, isRead: false },
    }),
  ]);

  return (
    <AppShell
      user={user}
      initialUnreadCount={unreadCount}
      projects={refData.projects}
      users={refData.users}
      tags={refData.tags}
    >
      {children}
    </AppShell>
  );
}
