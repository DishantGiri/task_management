"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { isAfter, isBefore, isToday, startOfDay } from "date-fns";
import {
  AlertTriangle,
  BookmarkCheck,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock,
  GitBranch,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import type { Role, TaskStatus } from "@prisma/client";
import type {
  PersonalTaskItem,
  TagSummary,
  TaskListItem,
  UserSummary,
} from "@/types";
import { updateTaskAction } from "@/actions/tasks";
import { cn, formatCompactDate, isTaskOverdue } from "@/lib/utils";
import { PriorityBadge } from "@/components/shared/badges";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TaskDetailDrawer } from "@/components/tasks/task-detail-drawer";
import { PersonalTasksClient } from "@/components/tasks/personal-tasks-client";

export function MyTasksClient({
  initialTasks,
  initialPersonalTasks = [],
  users,
  tags,
  currentUserId,
  currentUserRole,
}: {
  initialTasks: TaskListItem[];
  initialPersonalTasks?: PersonalTaskItem[];
  users: UserSummary[];
  tags: TagSummary[];
  currentUserId: string;
  currentUserRole: Role;
}) {
  const router = useRouter();
  const [scope, setScope] = useState<"assigned" | "personal">("assigned");
  const [tasks, setTasks] = useState(initialTasks);
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (priorityFilter !== "ALL" && t.priority !== priorityFilter)
        return false;
      if (
        q &&
        !t.title.toLowerCase().includes(q) &&
        !t.taskKey.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [tasks, search, priorityFilter]);

  const todayStart = startOfDay(new Date());

  const buckets = useMemo(() => {
    const today: TaskListItem[] = [];
    const overdue: TaskListItem[] = [];
    const upcoming: TaskListItem[] = [];
    const completed: TaskListItem[] = [];

    for (const t of filtered) {
      if (t.status === "DONE") {
        completed.push(t);
        continue;
      }
      if (!t.dueDate) {
        upcoming.push(t);
        continue;
      }
      const due = startOfDay(new Date(t.dueDate));
      if (isBefore(due, todayStart)) {
        overdue.push(t);
      } else if (isToday(due)) {
        today.push(t);
      } else if (isAfter(due, todayStart)) {
        upcoming.push(t);
      }
    }

    return { today, overdue, upcoming, completed };
  }, [filtered, todayStart]);

  const handleStatusChange = async (taskId: string, status: TaskStatus) => {
    const prev = tasks;
    setTasks((curr) =>
      curr.map((t) => (t.id === taskId ? { ...t, status } : t))
    );
    const res = await updateTaskAction({ id: taskId, status });
    if (res.error) {
      setTasks(prev);
      toast.error(res.error);
      return;
    }
    router.refresh();
  };

  const [bucketPage, setBucketPage] = useState<Record<string, number>>({});
  const MY_TASKS_PAGE_SIZE = 10;

  const renderTaskList = (
    items: TaskListItem[],
    emptyMessage: string,
    bucketKey = "default"
  ) => {
    if (items.length === 0) {
      return (
        <div className="rounded-lg border border-dashed border-[#D9DEE7] bg-white py-12 text-center">
          <p className="text-xs font-medium text-[#737987]">{emptyMessage}</p>
        </div>
      );
    }

    const rawPage = bucketPage[bucketKey] || 1;
    const totalPages = Math.max(1, Math.ceil(items.length / MY_TASKS_PAGE_SIZE));
    const safePage = Math.min(rawPage, totalPages);
    const pagedItems = items.slice(
      (safePage - 1) * MY_TASKS_PAGE_SIZE,
      safePage * MY_TASKS_PAGE_SIZE
    );

    return (
      <div className="space-y-3">
      <div className="divide-y divide-[#EAECF0] rounded-lg border border-[#EAECF0] bg-white shadow-subtle">
        {pagedItems.map((task) => {
          const isDone = task.status === "DONE";
          const overdue = isTaskOverdue(task.dueDate, task.status);
          const doneSubs = task.subtasks.filter((s) => s.status === "DONE").length;

          return (
            <div
              key={task.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 hover:bg-[#F7F8FA]/80 transition-colors"
            >
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() =>
                    handleStatusChange(task.id, isDone ? "TODO" : "DONE")
                  }
                  className="mt-0.5 shrink-0 text-[#737987] hover:text-[#635BDB]"
                >
                  {isDone ? (
                    <CheckCircle2 className="h-4 w-4 text-[#16A34A]" />
                  ) : (
                    <Circle className="h-4 w-4" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedTaskId(task.id);
                    setDrawerOpen(true);
                  }}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-[#9CA3AF]">
                      {task.taskKey}
                    </span>
                    <span
                      className={cn(
                        "truncate text-[13.5px] font-medium hover:text-[#5148C9]",
                        isDone
                          ? "line-through text-[#9CA3AF]"
                          : "text-[#20232B]"
                      )}
                    >
                      {task.title}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2.5 text-[11.5px] text-[#737987]">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 rounded-[2px]"
                        style={{ backgroundColor: task.project.color }}
                      />
                      {task.project.name}
                    </span>
                    {task.subtasks.length > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <GitBranch className="h-3 w-3" />
                        {doneSubs}/{task.subtasks.length} subtasks
                      </span>
                    )}
                    {task.parentId && (
                      <span className="rounded bg-[#F3F4F6] px-1.5 py-0.5 text-[10px]">
                        Subtask
                      </span>
                    )}
                  </div>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 sm:shrink-0 pl-7 sm:pl-0">
                <PriorityBadge priority={task.priority} />
                <Select
                  value={task.status}
                  onValueChange={(v) =>
                    handleStatusChange(task.id, v as TaskStatus)
                  }
                >
                  <SelectTrigger className="h-7 w-[122px] text-xs px-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODO">To Do</SelectItem>
                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                    <SelectItem value="IN_REVIEW">In Review</SelectItem>
                    <SelectItem value="DONE">Done</SelectItem>
                  </SelectContent>
                </Select>
                <span
                  className={cn(
                    "text-xs w-[72px] text-right",
                    overdue
                      ? "font-semibold text-[#EF4444]"
                      : "text-[#737987]"
                  )}
                >
                  {formatCompactDate(task.dueDate)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <PaginationBar
        currentPage={safePage}
        totalItems={items.length}
        pageSize={MY_TASKS_PAGE_SIZE}
        onPageChange={(next) =>
          setBucketPage((prev) => ({ ...prev, [bucketKey]: next }))
        }
        itemLabel="tasks"
      />
      </div>
    );
  };

  const totalCount = tasks.length;
  const doneCount = tasks.filter((t) => t.status === "DONE").length;
  const personalCompletion =
    totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Scope Switcher: Assigned Company Tasks vs Personal Tasks */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EAECF0] pb-3">
        <div className="inline-flex rounded-md border border-[#EAECF0] bg-white p-0.5 shadow-subtle">
          <button
            type="button"
            onClick={() => setScope("assigned")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-[5px] px-3 py-1.5 text-xs font-medium transition-colors",
              scope === "assigned"
                ? "bg-[#F0EFFF] text-[#5148C9]"
                : "text-[#737987] hover:text-[#20232B]"
            )}
          >
            <Briefcase className="h-3.5 w-3.5" />
            Assigned Project Tasks ({tasks.length})
          </button>
          <button
            type="button"
            onClick={() => setScope("personal")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-[5px] px-3 py-1.5 text-xs font-medium transition-colors",
              scope === "personal"
                ? "bg-[#F0EFFF] text-[#5148C9]"
                : "text-[#737987] hover:text-[#20232B]"
            )}
          >
            <BookmarkCheck className="h-3.5 w-3.5" />
            Personal To-Dos ({initialPersonalTasks.length})
          </button>
        </div>
      </div>

      {scope === "personal" ? (
        <PersonalTasksClient initialTasks={initialPersonalTasks} />
      ) : (
        <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight text-[#20232B]">
            My Tasks
          </h1>
          <p className="text-[13px] text-[#737987] mt-0.5">
            Personal workload, daily focus, upcoming deadlines, and completed work.
          </p>
        </div>

        {/* Personal Workload Mini-Meter */}
        <div className="rounded-lg border border-[#EAECF0] bg-white px-4 py-2.5 shadow-subtle min-w-[230px]">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-[#737987] font-medium">
              Personal completion
            </span>
            <span className="font-semibold text-[#20232B]">
              {doneCount}/{totalCount} ({personalCompletion}%)
            </span>
          </div>
          <Progress value={personalCompletion} className="h-1.5" />
        </div>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-lg border border-[#EAECF0] bg-white p-3.5 shadow-subtle">
          <div className="flex items-center justify-between text-xs text-[#737987]">
            <span>Due Today</span>
            <CalendarDays className="h-4 w-4 text-[#635BDB]" />
          </div>
          <p className="mt-1.5 text-xl font-semibold text-[#20232B]">
            {buckets.today.length}
          </p>
        </div>
        <div className="rounded-lg border border-[#EAECF0] bg-white p-3.5 shadow-subtle">
          <div className="flex items-center justify-between text-xs text-[#737987]">
            <span>Upcoming</span>
            <Clock className="h-4 w-4 text-[#3B82F6]" />
          </div>
          <p className="mt-1.5 text-xl font-semibold text-[#20232B]">
            {buckets.upcoming.length}
          </p>
        </div>
        <div className="rounded-lg border border-[#EAECF0] bg-white p-3.5 shadow-subtle">
          <div className="flex items-center justify-between text-xs text-[#737987]">
            <span>Overdue</span>
            <AlertTriangle className="h-4 w-4 text-[#EF4444]" />
          </div>
          <p className="mt-1.5 text-xl font-semibold text-[#EF4444]">
            {buckets.overdue.length}
          </p>
        </div>
        <div className="rounded-lg border border-[#EAECF0] bg-white p-3.5 shadow-subtle">
          <div className="flex items-center justify-between text-xs text-[#737987]">
            <span>Completed</span>
            <CheckCircle2 className="h-4 w-4 text-[#16A34A]" />
          </div>
          <p className="mt-1.5 text-xl font-semibold text-[#16A34A]">
            {buckets.completed.length}
          </p>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9CA3AF]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your tasks..."
            className="h-8 w-full rounded-md border border-[#E2E6EE] bg-white pl-8 pr-3 text-xs focus:border-[#635BDB] focus:outline-none"
          />
        </div>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="h-8 w-[140px] text-xs">
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
      </div>

      {/* Categorized Tabs */}
      <Tabs defaultValue={buckets.overdue.length > 0 ? "overdue" : "upcoming"}>
        <TabsList>
          <TabsTrigger value="today">
            Today ({buckets.today.length})
          </TabsTrigger>
          <TabsTrigger value="upcoming">
            Upcoming ({buckets.upcoming.length})
          </TabsTrigger>
          <TabsTrigger value="overdue">
            Overdue ({buckets.overdue.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({buckets.completed.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="today">
          {renderTaskList(buckets.today, "No tasks due today.")}
        </TabsContent>
        <TabsContent value="upcoming">
          {renderTaskList(buckets.upcoming, "No upcoming tasks assigned to you.")}
        </TabsContent>
        <TabsContent value="overdue">
          {renderTaskList(buckets.overdue, "No overdue tasks. Great work!")}
        </TabsContent>
        <TabsContent value="completed">
          {renderTaskList(buckets.completed, "No completed tasks yet.")}
        </TabsContent>
      </Tabs>

      <TaskDetailDrawer
        taskId={selectedTaskId}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        users={users}
        tags={tags}
      />
        </>
      )}
    </div>
  );
}
