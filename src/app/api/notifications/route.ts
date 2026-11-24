import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getCurrentUser,
  syncUpcomingDeadlineNotifications,
} from "@/lib/permissions";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Non-blocking background sync so API responds immediately
  void syncUpcomingDeadlineNotifications(user.id).catch(() => {});

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(
    50,
    Math.max(1, parseInt(searchParams.get("limit") || "20", 10))
  );
  const filter = searchParams.get("filter") === "unread" ? "unread" : "all";

  const listWhere =
    filter === "unread"
      ? { userId: user.id, isRead: false }
      : { userId: user.id };

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: listWhere,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        link: true,
        isRead: true,
        createdAt: true,
        actor: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    }),
    prisma.notification.count({ where: listWhere }),
    prisma.notification.count({
      where: { userId: user.id, isRead: false },
    }),
  ]);

  return NextResponse.json({
    data: notifications,
    unreadCount,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  if (body.markAll) {
    await prisma.notification.updateMany({
      where: { userId: user.id, isRead: false },
      data: { isRead: true },
    });
  } else if (body.id) {
    await prisma.notification.updateMany({
      where: { id: body.id, userId: user.id },
      data: { isRead: true },
    });
  }

  return NextResponse.json({ success: true });
}
