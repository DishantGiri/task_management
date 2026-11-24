"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AtSign,
  Bell,
  CalendarClock,
  CheckCheck,
  FolderKanban,
  ListTodo,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/actions/tasks";
import { cn, formatRelativeTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/avatar";
import { PaginationBar } from "@/components/shared/pagination-bar";

interface InboxNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
  actor: { id: string; name: string; avatarUrl: string | null } | null;
}

export function InboxClient({
  initialNotifications,
  currentPage = 1,
  pageSize = 12,
  totalFilteredCount,
  totalAllCount,
  initialUnreadCount,
  initialFilter = "all",
}: {
  initialNotifications: InboxNotification[];
  currentPage?: number;
  pageSize?: number;
  totalFilteredCount?: number;
  totalAllCount?: number;
  initialUnreadCount?: number;
  initialFilter?: "all" | "unread";
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(
    initialUnreadCount ?? initialNotifications.filter((n) => !n.isRead).length
  );

  // Keep synced when server-side pagination loads a new page
  const [prevInitial, setPrevInitial] = useState(initialNotifications);
  if (initialNotifications !== prevInitial) {
    setPrevInitial(initialNotifications);
    setItems(initialNotifications);
    if (initialUnreadCount !== undefined) {
      setUnreadCount(initialUnreadCount);
    }
  }

  const filter = initialFilter;
  const allCount = totalAllCount ?? items.length;
  const totalForPagination = totalFilteredCount ?? items.length;

  const navigateInbox = (nextPage: number, nextFilter: "all" | "unread") => {
    const sp = new URLSearchParams();
    if (nextFilter === "unread") sp.set("filter", "unread");
    if (nextPage > 1) sp.set("page", String(nextPage));
    const qs = sp.toString();
    router.push(qs ? `/inbox?${qs}` : "/inbox");
  };

  const handleOpen = async (item: InboxNotification) => {
    if (!item.isRead) {
      const nextUnread = Math.max(0, unreadCount - 1);
      setUnreadCount(nextUnread);
      setItems((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
      );
      window.dispatchEvent(
        new CustomEvent("meridian:notifications-updated", {
          detail: { unreadCount: nextUnread, readId: item.id },
        })
      );
      await markNotificationReadAction(item.id);
    }
    if (item.link) {
      router.push(item.link);
    }
  };

  const handleMarkAll = async () => {
    setUnreadCount(0);
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    window.dispatchEvent(
      new CustomEvent("meridian:notifications-updated", {
        detail: { unreadCount: 0, markAll: true },
      })
    );
    const res = await markAllNotificationsReadAction();
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("All notifications marked as read");
    router.refresh();
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "MENTION":
        return AtSign;
      case "COMMENT_ADDED":
        return MessageSquare;
      case "DEADLINE_APPROACHING":
        return CalendarClock;
      case "PROJECT_ADDED":
        return FolderKanban;
      case "TASK_ASSIGNED":
      case "TASK_UPDATED":
        return ListTodo;
      default:
        return Bell;
    }
  };

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight text-[#20232B]">
            Inbox
          </h1>
          <p className="text-[13px] text-[#737987] mt-0.5">
            Task assignments, @mentions, comments, and upcoming deadline alerts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border border-[#EAECF0] bg-white p-0.5">
            <button
              type="button"
              onClick={() => navigateInbox(1, "all")}
              className={cn(
                "rounded-[4px] px-3 py-1 text-xs font-medium",
                filter === "all"
                  ? "bg-[#F0EFFF] text-[#5148C9]"
                  : "text-[#737987] hover:text-[#20232B]"
              )}
            >
              All ({allCount})
            </button>
            <button
              type="button"
              onClick={() => navigateInbox(1, "unread")}
              className={cn(
                "rounded-[4px] px-3 py-1 text-xs font-medium",
                filter === "unread"
                  ? "bg-[#F0EFFF] text-[#5148C9]"
                  : "text-[#737987] hover:text-[#20232B]"
              )}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={handleMarkAll}>
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </Button>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#D9DEE7] bg-white py-16 text-center">
          <Bell className="mx-auto h-6 w-6 text-[#9CA3AF] mb-2" />
          <p className="text-sm font-medium text-[#20232B]">Inbox is clear</p>
          <p className="mt-1 text-xs text-[#737987]">
            {filter === "unread"
              ? "You have read all your notifications."
              : "Notifications for assignments, @mentions, and deadlines will appear here."}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[#EAECF0] rounded-lg border border-[#EAECF0] bg-white shadow-subtle overflow-hidden">
          {items.map((item) => {
            const Icon = getTypeIcon(item.type);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleOpen(item)}
                className={cn(
                  "flex w-full items-start gap-3.5 px-5 py-4 text-left transition-colors hover:bg-[#F7F8FA]",
                  !item.isRead && "bg-[#F0EFFF]/35"
                )}
              >
                <div className="mt-0.5 shrink-0">
                  {item.actor ? (
                    <UserAvatar
                      name={item.actor.name}
                      avatarUrl={item.actor.avatarUrl}
                      size="md"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F0EFFF] text-[#635BDB]">
                      <Icon className="h-4 w-4" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {!item.isRead && (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-[#635BDB]" />
                      )}
                      <p className="truncate text-[13.5px] font-semibold text-[#20232B]">
                        {item.title}
                      </p>
                    </div>
                    <span className="text-[11px] text-[#9CA3AF] shrink-0">
                      {formatRelativeTime(item.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-[13px] text-[#525866] leading-relaxed">
                    {item.message}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <PaginationBar
        currentPage={currentPage}
        totalItems={totalForPagination}
        pageSize={pageSize}
        onPageChange={(nextPage) => navigateInbox(nextPage, filter)}
        itemLabel="notifications"
      />
    </div>
  );
}
