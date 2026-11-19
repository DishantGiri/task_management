import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  getCurrentUser,
  syncUpcomingDeadlineNotifications,
} from "@/lib/permissions";
import { InboxClient } from "@/components/tasks/inbox-client";

export default async function InboxPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  await syncUpcomingDeadlineNotifications(user.id);

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      actor: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  return (
    <InboxClient
      initialNotifications={notifications.map((n) => ({
        ...n,
        createdAt: n.createdAt.toISOString(),
      }))}
    />
  );
}
