"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Calendar,
  GanttChartSquare,
  Kanban,
  List,
  Plus,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  X,
} from "lucide-react";
import type { Priority, Role, TaskStatus } from "@prisma/client";
import type {
  ProjectSummary,
  TagSummary,
  TaskListItem,
  UserSummary,
} from "@/types";
import { cn, getDisplayTaskProgress } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KanbanBoard } from "@/components/tasks/kanban-board";
import { TaskListView } from "@/components/tasks/task-list-view";
import { TaskCalendarView } from "@/components/tasks/task-calendar-view";
import {
  TaskTimelineView,
  type TimelineMilestone,
} from "@/components/tasks/task-timeline-view";
import { TaskDetailDrawer } from "@/components/tasks/task-detail-drawer";
import { CreateTaskDialog } from "@/components/tasks/create-task-dialog";

type ViewMode = "kanban" | "list" | "calendar" | "timeline";
type SortField = "updated" | "dueDate" | "priority" | "title" | "progress";

const PRIORITY_WEIGHT: Record<Priority, number> = {
  URGENT: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

interface TasksWorkspaceProps {
  initialTasks: TaskListItem[];
  milestones?: TimelineMilestone[];
  projects: ProjectSummary[];
  users: UserSummary[];
  tags: TagSummary[];
  currentUserId: string;
  currentUserRole: Role;
  canManageProject?: boolean;
  fixedProjectId?: string;
  defaultView?: ViewMode;
  showScopeToggle?: boolean;
  defaultScope?: "mine" | "all";
  title?: string;
  subtitle?: string;
}

export function TasksWorkspace({
  initialTasks,
  milestones = [],
  projects,
  users,
  tags,
  currentUserId,
  currentUserRole,
  canManageProject = false,
  fixedProjectId,
  defaultView = "kanban",
  showScopeToggle = false,
  defaultScope = "all",
  title,
  subtitle,
}: TasksWorkspaceProps) {
  const searchParams = useSearchParams();
  const [tasks, setTasks] = useState<TaskListItem[]>(initialTasks);
  const [view, setView] = useState<ViewMode>(() => {
    const pv = searchParams.get("view");
    if (pv === "kanban" || pv === "list" || pv === "calendar" || pv === "timeline") {
      return pv;
    }
    return defaultView;
  });
  const [scope, setScope] = useState<"mine" | "all">(() => {
    const ps = searchParams.get("scope");
    if (ps === "mine" || ps === "all") return ps;
    return defaultScope;
  });

  // Filters & search
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState<string>(
    fixedProjectId || "ALL"
  );
  const [statusFilter, setStatusFilter] = useState<string>(
    searchParams.get("status") || "ALL"
  );
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("ALL");
  const [flaggedOnly, setFlaggedOnly] = useState<boolean>(
    searchParams.get("flagged") === "1"
  );
  const [sortBy, setSortBy] = useState<SortField>("updated");

  // Modals & Drawer
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(
    searchParams.get("taskId")
  );
  const [drawerOpen, setDrawerOpen] = useState(!!searchParams.get("taskId"));
  const [createOpen, setCreateOpen] = useState(false);
  const [quickStatus, setQuickStatus] = useState<TaskStatus>("TODO");

  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  useEffect(() => {
    const paramTaskId = searchParams.get("taskId");
    if (paramTaskId) {
      setSelectedTaskId(paramTaskId);
      setDrawerOpen(true);
    }
    const pv = searchParams.get("view");
    if (pv === "kanban" || pv === "list" || pv === "calendar" || pv === "timeline") {
      setView(pv);
    }
    const ps = searchParams.get("scope");
    if (ps === "mine" || ps === "all") {
      setScope(ps);
    }
    if (searchParams.get("flagged") === "1") {
      setFlaggedOnly(true);
    }
  }, [searchParams]);

  const canCreate =
    currentUserRole === "ADMIN" ||
    currentUserRole === "MANAGER" ||
    canManageProject;

  const myTasksCount = useMemo(
    () =>
      tasks.filter(
        (t) =>
          t.assigneeId === currentUserId ||
          t.collaborators.some((c) => c.user.id === currentUserId)
      ).length,
    [tasks, currentUserId]
  );

  const flaggedCount = useMemo(
    () => tasks.filter((t) => t.qaBypassed && t.status === "DONE").length,
    [tasks]
  );

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = tasks.filter((t) => {
      if (flaggedOnly && !(t.qaBypassed && t.status === "DONE")) {
        return false;
      }
      if (
        showScopeToggle &&
        scope === "mine" &&
        t.assigneeId !== currentUserId &&
        !t.collaborators.some((c) => c.user.id === currentUserId)
      ) {
        return false;
      }
      if (projectFilter !== "ALL" && t.projectId !== projectFilter) return false;
      if (statusFilter !== "ALL" && t.status !== statusFilter) return false;
      if (priorityFilter !== "ALL" && t.priority !== priorityFilter)
        return false;
      if (assigneeFilter === "UNASSIGNED" && t.assigneeId !== null) return false;
      if (
        assigneeFilter !== "ALL" &&
        assigneeFilter !== "UNASSIGNED" &&
        t.assigneeId !== assigneeFilter &&
        !t.collaborators.some((c) => c.user.id === assigneeFilter)
      ) {
        return false;
      }
      if (q) {
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchKey = t.taskKey.toLowerCase().includes(q);
        const matchSub = t.subtasks.some((s) =>
          s.title.toLowerCase().includes(q)
        );
        if (!matchTitle && !matchKey && !matchSub) return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      switch (sortBy) {
        case "dueDate": {
          const ad = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
          const bd = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
          return ad - bd;
        }
        case "priority":
          return PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
        case "title":
          return a.title.localeCompare(b.title);
        case "progress":
          return getDisplayTaskProgress(b) - getDisplayTaskProgress(a);
        default:
          return (
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
      }
    });
  }, [
    tasks,
    search,
    projectFilter,
    statusFilter,
    priorityFilter,
    assigneeFilter,
    flaggedOnly,
    sortBy,
    showScopeToggle,
    scope,
    currentUserId,
  ]);

  const hasActiveFilters =
    search.trim() !== "" ||
    (!fixedProjectId && projectFilter !== "ALL") ||
    statusFilter !== "ALL" ||
    priorityFilter !== "ALL" ||
    assigneeFilter !== "ALL" ||
    flaggedOnly;

  const clearFilters = () => {
    setSearch("");
    if (!fixedProjectId) setProjectFilter("ALL");
    setStatusFilter("ALL");
    setPriorityFilter("ALL");
    setAssigneeFilter("ALL");
    setFlaggedOnly(false);
  };

  const handleOpenTask = (id: string) => {
    setSelectedTaskId(id);
    setDrawerOpen(true);
  };

  const handleQuickAdd = (status: TaskStatus) => {
    setQuickStatus(status);
    setCreateOpen(true);
  };

  const viewTabs: { id: ViewMode; label: string; icon: typeof Kanban }[] = [
    { id: "kanban", label: "Board", icon: Kanban },
    { id: "list", label: "List", icon: List },
    { id: "calendar", label: "Calendar", icon: Calendar },
    { id: "timeline", label: "Timeline", icon: GanttChartSquare },
  ];

  return (
    <div className="space-y-4">
      {/* Optional Page Title Header */}
      {title && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-[24px] font-semibold tracking-tight text-[#20232B]">
              {title}
            </h1>
            {subtitle && (
              <p className="text-[13px] text-[#737987] mt-0.5">{subtitle}</p>
            )}
          </div>
          {canCreate && projects.length > 0 && (
            <Button
              size="sm"
              onClick={() => {
                setQuickStatus("TODO");
                setCreateOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              New Task
            </Button>
          )}
        </div>
      )}

      {/* View Switcher + Filter Toolbar */}
      <div className="flex flex-col gap-3 rounded-lg border border-[#EAECF0] bg-white p-3 shadow-subtle">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Optional My Tasks / All Tasks Scope Toggle */}
            {showScopeToggle && (
              <div className="inline-flex items-center rounded-md border border-[#EAECF0] bg-[#F7F8FA] p-0.5">
                <button
                  type="button"
                  onClick={() => setScope("mine")}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-[5px] px-3 py-1.5 text-xs font-medium transition-all",
                    scope === "mine"
                      ? "bg-[#635BDB] text-white shadow-subtle"
                      : "text-[#737987] hover:text-[#20232B]"
                  )}
                >
                  My Tasks
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0 text-[10px]",
                      scope === "mine"
                        ? "bg-white/20 text-white"
                        : "bg-[#EAECF0] text-[#525866]"
                    )}
                  >
                    {myTasksCount}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setScope("all")}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-[5px] px-3 py-1.5 text-xs font-medium transition-all",
                    scope === "all"
                      ? "bg-[#635BDB] text-white shadow-subtle"
                      : "text-[#737987] hover:text-[#20232B]"
                  )}
                >
                  All Tasks
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0 text-[10px]",
                      scope === "all"
                        ? "bg-white/20 text-white"
                        : "bg-[#EAECF0] text-[#525866]"
                    )}
                  >
                    {tasks.length}
                  </span>
                </button>
              </div>
            )}

            {/* View Tabs */}
            <div className="inline-flex items-center rounded-md border border-[#EAECF0] bg-[#F7F8FA] p-0.5">
              {viewTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setView(tab.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-[5px] px-3 py-1.5 text-xs font-medium transition-all",
                      view === tab.id
                        ? "bg-white text-[#20232B] shadow-subtle"
                        : "text-[#737987] hover:text-[#20232B]"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search & Sort */}
          <div className="flex flex-wrap items-center gap-2 flex-1 justify-end">
            <div className="relative min-w-[200px] max-w-xs flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9CA3AF]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter by title, key, subtask..."
                className="h-8 w-full rounded-md border border-[#E2E6EE] bg-white pl-8 pr-3 text-xs text-[#20232B] placeholder:text-[#9CA3AF] focus:border-[#635BDB] focus:outline-none"
              />
            </div>

            <Select
              value={sortBy}
              onValueChange={(v) => setSortBy(v as SortField)}
            >
              <SelectTrigger className="h-8 w-[145px] text-xs">
                <SlidersHorizontal className="h-3.5 w-3.5 mr-1 text-[#737987]" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updated">Recently Updated</SelectItem>
                <SelectItem value="dueDate">Due Date</SelectItem>
                <SelectItem value="priority">Priority</SelectItem>
                <SelectItem value="progress">Progress</SelectItem>
                <SelectItem value="title">Title (A-Z)</SelectItem>
              </SelectContent>
            </Select>

            {!title && canCreate && projects.length > 0 && (
              <Button
                size="sm"
                className="h-8"
                onClick={() => {
                  setQuickStatus("TODO");
                  setCreateOpen(true);
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                Add Task
              </Button>
            )}
          </div>
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#F1F3F7]">
          {!fixedProjectId && (
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="h-7 w-auto min-w-[130px] text-xs">
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Projects</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-7 w-auto min-w-[120px] text-xs">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="TODO">To Do</SelectItem>
              <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
              <SelectItem value="IN_REVIEW">In Review</SelectItem>
              <SelectItem value="DONE">Done</SelectItem>
            </SelectContent>
          </Select>

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="h-7 w-auto min-w-[120px] text-xs">
              <SelectValue placeholder="All Priorities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Priorities</SelectItem>
              <SelectItem value="URGENT">Urgent</SelectItem>
              <SelectItem value="HIGH">High</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="LOW">Low</SelectItem>
            </SelectContent>
          </Select>

          <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
            <SelectTrigger className="h-7 w-auto min-w-[135px] text-xs">
              <SelectValue placeholder="All Assignees" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Assignees</SelectItem>
              <SelectItem value="UNASSIGNED">Unassigned</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(flaggedCount > 0 || flaggedOnly) && (
            <button
              type="button"
              onClick={() => setFlaggedOnly((prev) => !prev)}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors",
                flaggedOnly
                  ? "border-red-600 bg-red-600 text-white"
                  : "border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
              )}
              title="Filter tickets forcefully marked Done without QA / Testing"
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              QA Bypassed ({flaggedCount})
            </button>
          )}

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-[#635BDB] hover:bg-[#F0EFFF]"
            >
              <X className="h-3 w-3" />
              Reset filters
            </button>
          )}

          <span className="ml-auto text-[11.5px] text-[#737987]">
            {filteredTasks.length}{" "}
            {filteredTasks.length === 1 ? "task" : "tasks"}
          </span>
        </div>
      </div>

      {/* Active View */}
      {view === "kanban" && (
        <KanbanBoard
          tasks={filteredTasks}
          onTasksChange={setTasks}
          onSelectTask={handleOpenTask}
          onQuickAdd={handleQuickAdd}
          canCreate={canCreate}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          canManageProject={canManageProject}
        />
      )}

      {view === "list" && (
        <TaskListView
          tasks={filteredTasks}
          onSelectTask={handleOpenTask}
          onTasksChange={setTasks}
          showProjectColumn={!fixedProjectId}
        />
      )}

      {view === "calendar" && (
        <TaskCalendarView
          tasks={filteredTasks}
          onSelectTask={handleOpenTask}
        />
      )}

      {view === "timeline" && (
        <TaskTimelineView
          tasks={filteredTasks}
          milestones={
            projectFilter === "ALL"
              ? milestones
              : milestones.filter((m) => m.projectId === projectFilter)
          }
          onSelectTask={handleOpenTask}
        />
      )}

      {/* Task Detail Side Drawer */}
      <TaskDetailDrawer
        taskId={selectedTaskId}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        users={users}
        tags={tags}
        allProjectTasks={tasks.flatMap((t) => [
          {
            id: t.id,
            taskKey: t.taskKey,
            title: t.title,
            projectId: t.projectId,
            status: t.status,
            isSubtask: false,
          },
          ...t.subtasks.map((s) => ({
            id: s.id,
            taskKey: s.taskKey,
            title: s.title,
            projectId: t.projectId,
            status: s.status,
            isSubtask: true,
          })),
        ])}
      />

      {/* Create Task Dialog */}
      {canCreate && (
        <CreateTaskDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          projects={projects}
          users={users}
          tags={tags}
          defaultProjectId={fixedProjectId || projects[0]?.id}
          defaultStatus={quickStatus}
          availableDependencies={tasks.flatMap((t) => [
            {
              id: t.id,
              taskKey: t.taskKey,
              title: t.title,
              projectId: t.projectId,
              status: t.status,
              isSubtask: false,
            },
            ...t.subtasks.map((s) => ({
              id: s.id,
              taskKey: s.taskKey,
              title: s.title,
              projectId: t.projectId,
              status: s.status,
              isSubtask: true,
            })),
          ])}
          onCreated={(newTask) => {
            if (newTask) {
              setTasks((prev) => [newTask, ...prev]);
            }
          }}
        />
      )}
    </div>
  );
}
