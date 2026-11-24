import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  getCurrentUser,
  syncUpcomingDeadlineNotifications,
} from "@/lib/permissions";
import { InboxClient } from "@/components/tasks/inbox-client";

const PAGE_SIZE = 12;

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; filter?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?reauth=1");

  // Run deadline sync non-blocking so Inbox loads immediately
  void syncUpcomingDeadlineNotifications(user.id).catch(() => {});

  const params = await searchParams;
  const filter = params.filter === "unread" ? "unread" : "all";
  const requestedPage = Math.max(1, parseInt(params.page || "1", 10) || 1);

  const listWhere =
    filter === "unread"
      ? { userId: user.id, isRead: false }
      : { userId: user.id };

  const [notifications, totalCount, allCount, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: listWhere,
      orderBy: { createdAt: "desc" },
      skip: (requestedPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        link: true,
        isRead: true,
        createdAt: true,
        actor: { select: { id: true, name: true, avatarUrl: true } },
      },
    }),
    prisma.notification.count({ where: listWhere }),
    prisma.notification.count({ where: { userId: user.id } }),
    prisma.notification.count({ where: { userId: user.id, isRead: false } }),
  ]);

  return (
    <InboxClient
      initialNotifications={notifications.map((n) => ({
        ...n,
        createdAt: n.createdAt.toISOString(),
      }))}
      currentPage={requestedPage}
      pageSize={PAGE_SIZE}
      totalFilteredCount={totalCount}
      totalAllCount={allCount}
      initialUnreadCount={unreadCount}
      initialFilter={filter}
    />
  );
}
