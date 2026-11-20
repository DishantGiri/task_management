"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Bell,
  BookmarkCheck,
  Calendar,
  CheckCheck,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  Inbox,
  Layers,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  Users,
} from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { SessionUser } from "@/lib/permissions";
import type { ProjectSummary, TagSummary, UserSummary } from "@/types";
import { logoutAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/avatar";
import { RoleBadge } from "@/components/shared/badges";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CreateTaskDialog } from "@/components/tasks/create-task-dialog";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
  actor: { id: string; name: string; avatarUrl: string | null } | null;
}

interface SearchResults {
  tasks: {
    id: string;
    taskKey: string;
    title: string;
    status: string;
    project: { name: string; color: string };
  }[];
  projects: { id: string; code: string; name: string; color: string }[];
  people: {
    id: string;
    name: string;
    email: string;
    designation: string | null;
  }[];
}

const NAV_ITEMS = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "My Tasks", href: "/my-tasks", icon: CheckSquare },
  { label: "Personal Tasks", href: "/personal-tasks", icon: BookmarkCheck },
  { label: "Inbox", href: "/inbox", icon: Inbox, showBadge: true },
  { label: "Projects", href: "/projects", icon: FolderKanban },
  { label: "All Tasks", href: "/tasks", icon: ListTodo },
  { label: "Calendar", href: "/calendar", icon: Calendar },
  { label: "Team", href: "/team", icon: Users },
  { label: "Reports", href: "/reports", icon: BarChart3 },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function AppShell({
  user,
  initialUnreadCount,
  projects,
  users,
  tags,
  children,
}: {
  user: SessionUser;
  initialUnreadCount: number;
  projects: ProjectSummary[];
  users: UserSummary[];
  tags: TagSummary[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);

  // Notifications state with near-real-time polling
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [notifOpen, setNotifOpen] = useState(false);

  // Global search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      setNotifications(json.data || []);
      setUnreadCount(json.unreadCount ?? 0);
    } catch {
      // ignore transient network issues
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 25000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Warm the Next.js router cache for all primary sidebar routes
  useEffect(() => {
    const timer = setTimeout(() => {
      for (const item of NAV_ITEMS) {
        router.prefetch(item.href);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [router]);

  // Keyboard shortcut Cmd+K / Ctrl+K for global search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
          setSearchOpen(true);
        }
      } catch {
        // ignore
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const markAsRead = async (id: string, link?: string | null) => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    setNotifOpen(false);
    if (link) router.push(link);
  };

  const markAllRead = async () => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  };

  const canCreateTasks = user.role === "ADMIN" || user.role === "MANAGER";

  const renderSidebarNav = (isMobile = false) => (
    <div className="flex h-full flex-col bg-white">
      {/* Brand Header */}
      <div
        className={cn(
          "flex h-[60px] items-center border-b border-[#EAECF0] px-4",
          collapsed && !isMobile ? "justify-center px-2" : "justify-between"
        )}
      >
        <Link
          href="/dashboard"
          className="flex items-center gap-2 min-w-0"
          onClick={() => isMobile && setMobileOpen(false)}
        >
          {collapsed && !isMobile ? (
            <img
              src="/logo-icon.png"
              alt="Meridian"
              className="h-7 w-auto object-contain shrink-0"
            />
          ) : (
            <img
              src="/logo.png"
              alt="Meridian — Acme Enterprise"
              className="h-9 w-auto max-w-[168px] object-contain"
            />
          )}
        </Link>

        {!isMobile && !collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            aria-label="Collapse sidebar"
            className="rounded-md p-1 text-[#737987] hover:bg-[#F3F4F6] hover:text-[#20232B] transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));

          const linkEl = (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              onClick={() => isMobile && setMobileOpen(false)}
              className={cn(
                "group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors",
                collapsed && !isMobile ? "justify-center px-2" : "",
                isActive
                  ? "bg-[#F0EFFF] text-[#5148C9]"
                  : "text-[#525866] hover:bg-[#F7F8FA] hover:text-[#20232B]"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  isActive
                    ? "text-[#635BDB]"
                    : "text-[#737987] group-hover:text-[#20232B]"
                )}
              />
              {(!collapsed || isMobile) && (
                <>
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.showBadge && unreadCount > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#635BDB] px-1.5 text-[10px] font-semibold text-white">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </>
              )}
            </Link>
          );

          if (collapsed && !isMobile) {
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>{linkEl}</TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            );
          }

          return linkEl;
        })}

        {/* Active Projects Quick Jump */}
        {(!collapsed || isMobile) && projects.length > 0 && (
          <div className="pt-5">
            <div className="px-2.5 pb-1.5 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF]">
                Projects
              </span>
              <Link
                href="/projects"
                className="text-[11px] text-[#737987] hover:text-[#635BDB]"
              >
                All
              </Link>
            </div>
            <div className="space-y-0.5">
              {projects.slice(0, 5).map((p) => {
                const active = pathname === `/projects/${p.id}`;
                return (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}`}
                    onClick={() => isMobile && setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[12.5px] transition-colors",
                      active
                        ? "bg-[#F0EFFF] font-medium text-[#5148C9]"
                        : "text-[#525866] hover:bg-[#F7F8FA] hover:text-[#20232B]"
                    )}
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-[2px]"
                      style={{ backgroundColor: p.color }}
                    />
                    <span className="truncate flex-1">{p.name}</span>
                    <span className="text-[10px] font-mono text-[#9CA3AF]">
                      {p.code}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      {/* Sidebar Footer */}
      <div className="border-t border-[#EAECF0] p-2.5">
        {collapsed && !isMobile ? (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            aria-label="Expand sidebar"
            className="flex w-full items-center justify-center rounded-md p-2 text-[#737987] hover:bg-[#F7F8FA] hover:text-[#20232B]"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <div className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
            <UserAvatar name={user.name} avatarUrl={user.avatarUrl} size="md" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-medium text-[#20232B]">
                {user.name}
              </p>
              <p className="truncate text-[11px] text-[#737987]">
                {user.designation || user.role}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[#F7F8FA]">
      {/* Desktop Sticky / Fixed-Viewport Sidebar */}
      <aside
        className={cn(
          "hidden lg:flex h-screen shrink-0 flex-col border-r border-[#EAECF0] bg-white transition-[width] duration-200 z-30",
          collapsed ? "w-[64px]" : "w-[244px]"
        )}
      >
        {renderSidebarNav(false)}
      </aside>

      {/* Mobile Drawer Sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-[260px]" hideClose>
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          {renderSidebarNav(true)}
        </SheetContent>
      </Sheet>

      {/* Main Content Area (independently scrollable so sidebar stays locked) */}
      <div className="flex flex-1 flex-col min-w-0 h-screen overflow-y-auto">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-[60px] shrink-0 items-center justify-between gap-3 border-b border-[#EAECF0] bg-white/95 backdrop-blur px-4 lg:px-7">
          <div className="flex items-center gap-3 flex-1 max-w-md">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden shrink-0"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </Button>

            {/* Global Search */}
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9CA3AF]" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchResults && setSearchOpen(true)}
                onBlur={() => setTimeout(() => setSearchOpen(false), 180)}
                placeholder="Search tasks, projects, teammates..."
                className="h-8 w-full rounded-md border border-[#EAECF0] bg-[#F7F8FA] pl-8 pr-12 text-[12.5px] text-[#20232B] placeholder:text-[#9CA3AF] focus:border-[#635BDB] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#635BDB]/15 transition-all"
              />
              <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-[#E2E6EE] bg-white px-1.5 py-0.5 text-[10px] font-medium text-[#9CA3AF] sm:inline-block">
                ⌘K
              </kbd>

              {searchOpen && searchResults && (
                <div className="absolute left-0 right-0 top-10 z-50 rounded-lg border border-[#EAECF0] bg-white p-2 shadow-lg space-y-2">
                  {searchResults.tasks.length === 0 &&
                  searchResults.projects.length === 0 &&
                  searchResults.people.length === 0 ? (
                    <p className="px-2 py-3 text-center text-xs text-[#737987]">
                      No matches for &ldquo;{searchQuery}&rdquo;
                    </p>
                  ) : (
                    <>
                      {searchResults.tasks.length > 0 && (
                        <div>
                          <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF]">
                            Tasks
                          </p>
                          {searchResults.tasks.map((t) => (
                            <button
                              key={t.id}
                              type="button"
                              onMouseDown={() => {
                                setSearchQuery("");
                                setSearchOpen(false);
                                router.push(`/tasks?taskId=${t.id}`);
                              }}
                              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-[#F7F8FA]"
                            >
                              <span className="font-mono text-[11px] text-[#737987]">
                                {t.taskKey}
                              </span>
                              <span className="truncate flex-1 font-medium text-[#20232B]">
                                {t.title}
                              </span>
                              <span className="text-[10px] text-[#737987]">
                                {t.project.name}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                      {searchResults.projects.length > 0 && (
                        <div>
                          <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF]">
                            Projects
                          </p>
                          {searchResults.projects.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onMouseDown={() => {
                                setSearchQuery("");
                                setSearchOpen(false);
                                router.push(`/projects/${p.id}`);
                              }}
                              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-[#F7F8FA]"
                            >
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: p.color }}
                              />
                              <span className="font-medium text-[#20232B]">
                                {p.name}
                              </span>
                              <span className="font-mono text-[10px] text-[#9CA3AF]">
                                {p.code}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                      {searchResults.people.length > 0 && (
                        <div>
                          <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF]">
                            Team
                          </p>
                          {searchResults.people.map((person) => (
                            <button
                              key={person.id}
                              type="button"
                              onMouseDown={() => {
                                setSearchQuery("");
                                setSearchOpen(false);
                                router.push(`/team?q=${encodeURIComponent(person.name)}`);
                              }}
                              className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs hover:bg-[#F7F8FA]"
                            >
                              <span className="font-medium text-[#20232B]">
                                {person.name}
                              </span>
                              <span className="text-[11px] text-[#737987]">
                                {person.designation || person.email}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2">
            {canCreateTasks && projects.length > 0 && (
              <Button
                size="sm"
                onClick={() => setCreateTaskOpen(true)}
                className="h-8 gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">New Task</span>
              </Button>
            )}

            {/* Notifications Popover */}
            <Popover open={notifOpen} onOpenChange={setNotifOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative h-8 w-8"
                  aria-label="Notifications"
                >
                  <Bell className="h-4 w-4 text-[#525866]" />
                  {unreadCount > 0 && (
                    <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#EF4444] ring-2 ring-white" />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[360px]">
                <div className="flex items-center justify-between border-b border-[#EAECF0] px-3.5 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-[#20232B]">
                      Notifications
                    </span>
                    {unreadCount > 0 && (
                      <span className="rounded-full bg-[#F0EFFF] px-1.5 py-0.5 text-[10px] font-semibold text-[#5148C9]">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllRead}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-[#635BDB] hover:text-[#5148C9]"
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-[340px] overflow-y-auto divide-y divide-[#EAECF0]">
                  {notifications.length === 0 ? (
                    <div className="py-10 text-center text-xs text-[#737987]">
                      You&apos;re all caught up. No notifications yet.
                    </div>
                  ) : (
                    notifications.slice(0, 10).map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => markAsRead(n.id, n.link)}
                        className={cn(
                          "flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-[#F7F8FA]",
                          !n.isRead && "bg-[#F0EFFF]/40"
                        )}
                      >
                        <div
                          className={cn(
                            "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                            n.isRead ? "bg-transparent" : "bg-[#635BDB]"
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-[#20232B] truncate">
                            {n.title}
                          </p>
                          <p className="text-[11.5px] text-[#737987] line-clamp-2 mt-0.5">
                            {n.message}
                          </p>
                          <p className="text-[10.5px] text-[#9CA3AF] mt-1">
                            {formatRelativeTime(n.createdAt)}
                          </p>
                        </div>
                      </button>
                    ))
                  )}
                </div>

                <div className="border-t border-[#EAECF0] px-3.5 py-2 text-center">
                  <Link
                    href="/inbox"
                    onClick={() => setNotifOpen(false)}
                    className="text-xs font-medium text-[#635BDB] hover:text-[#5148C9]"
                  >
                    View all in Inbox
                  </Link>
                </div>
              </PopoverContent>
            </Popover>

            {/* User Profile Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-md p-1 hover:bg-[#F7F8FA] transition-colors focus:outline-none"
                >
                  <UserAvatar
                    name={user.name}
                    avatarUrl={user.avatarUrl}
                    size="md"
                  />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-[#20232B] truncate">
                        {user.name}
                      </p>
                      <RoleBadge role={user.role} />
                    </div>
                    <p className="text-[11px] text-[#737987] truncate">
                      {user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/my-tasks">
                    <CheckSquare className="h-3.5 w-3.5 text-[#737987]" />
                    My Tasks
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings">
                    <Settings className="h-3.5 w-3.5 text-[#737987]" />
                    Account Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-600 focus:text-red-600 focus:bg-red-50"
                  onSelect={async (e) => {
                    e.preventDefault();
                    await logoutAction();
                    window.location.href = "/login";
                  }}
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Container */}
        <main className="flex-1 p-5 lg:p-7 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Quick Create Task Modal */}
      {canCreateTasks && (
        <CreateTaskDialog
          open={createTaskOpen}
          onOpenChange={setCreateTaskOpen}
          projects={projects}
          users={users}
          tags={tags}
        />
      )}
    </div>
  );
}
