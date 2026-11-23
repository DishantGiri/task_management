"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  GitBranch,
  MessageSquare,
  Paperclip,
} from "lucide-react";
import { toast } from "sonner";
import type { TaskStatus } from "@prisma/client";
import type { TaskListItem } from "@/types";
import { updateTaskAction } from "@/actions/tasks";
import {
  cn,
  formatCompactDate,
  getDisplayTaskProgress,
  getStatusProgressScore,
  isTaskOverdue,
} from "@/lib/utils";
import { PriorityBadge } from "@/components/shared/badges";
import { UserAvatar } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PAGE_SIZE = 15;

export function TaskListView({
  tasks,
  onSelectTask,
  onTasksChange,
  showProjectColumn = true,
}: {
  tasks: TaskListItem[];
  onSelectTask: (id: string) => void;
  onTasksChange: (next: TaskListItem[]) => void;
  showProjectColumn?: boolean;
}) {
  const router = useRouter();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    // Expand first task that has subtasks so nested subtasks are immediately discoverable
    const firstWithSubs = tasks.find((t) => t.subtasks.length > 0);
    return firstWithSubs ? new Set([firstWithSubs.id]) : new Set();
  });
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(tasks.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedTasks = tasks.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleStatusChange = async (
    taskId: string,
    status: TaskStatus,
    isSubtask = false,
    parentId?: string
  ) => {
    const previous = tasks;
    const nextProgress =
      status === "DONE"
        ? 100
        : status === "IN_REVIEW"
        ? 75
        : status === "IN_PROGRESS"
        ? 40
        : 0;

    if (!isSubtask) {
      onTasksChange(
        tasks.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status,
                progress: getDisplayTaskProgress({ ...t, status }),
              }
            : t
        )
      );
    } else if (parentId) {
      onTasksChange(
        tasks.map((t) => {
          if (t.id !== parentId) return t;
          const updatedSubs = t.subtasks.map((s) =>
            s.id === taskId ? { ...s, status, progress: nextProgress } : s
          );
          const doneCount = updatedSubs.filter((s) => s.status === "DONE").length;
          const rawAvg =
            doneCount === updatedSubs.length
              ? 100
              : Math.round(
                  updatedSubs.reduce(
                    (acc, s) =>
                      acc +
                      (s.status === "DONE"
                        ? 100
                        : s.status === "IN_REVIEW"
                        ? 75
                        : s.status === "IN_PROGRESS"
                        ? 40
                        : 0),
                    0
                  ) / updatedSubs.length
                );
          return {
            ...t,
            subtasks: updatedSubs,
            progress: t.status === "DONE" ? 100 : Math.min(rawAvg, 90),
          };
        })
      );
    }

    const res = await updateTaskAction({ id: taskId, status });
    if (res.error) {
      onTasksChange(previous);
      toast.error(res.error);
      return;
    }
    router.refresh();
  };

  if (tasks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[#D9DEE7] bg-white py-14 text-center">
        <p className="text-sm font-medium text-[#20232B]">No tasks found</p>
        <p className="mt-1 text-xs text-[#737987]">
          Try adjusting your filters or create a new task.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#EAECF0] bg-white shadow-subtle overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[780px]">
          <thead>
            <tr className="border-b border-[#EAECF0] bg-[#F7F8FA] text-[11px] font-semibold uppercase tracking-wider text-[#737987]">
              <th className="py-2.5 pl-4 pr-3 w-[38%]">Task</th>
              {showProjectColumn && <th className="py-2.5 px-3">Project</th>}
              <th className="py-2.5 px-3">Assignee</th>
              <th className="py-2.5 px-3">Priority</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3">Due Date</th>
              <th className="py-2.5 pl-3 pr-4 w-[130px]">Progress</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EAECF0] text-[13px]">
            {paginatedTasks.map((task) => {
              const hasSubtasks = task.subtasks.length > 0;
              const isExpanded = expandedIds.has(task.id);
              const doneSubs = task.subtasks.filter(
                (s) => s.status === "DONE"
              ).length;
              const overdue = isTaskOverdue(task.dueDate, task.status);

              return (
                <Fragment key={task.id}>
                  <tr className="group hover:bg-[#F7F8FA]/80 transition-colors">
                    {/* Task Title & Expand Toggle */}
                    <td className="py-2.5 pl-4 pr-3">
                      <div className="flex items-center gap-2">
                        {hasSubtasks ? (
                          <button
                            type="button"
                            onClick={() => toggleExpand(task.id)}
                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-[#EAECF0] text-[#737987]"
                            aria-label={
                              isExpanded ? "Collapse subtasks" : "Expand subtasks"
                            }
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5" />
                            )}
                          </button>
                        ) : (
                          <span className="w-5 shrink-0" />
                        )}

                        <button
                          type="button"
                          onClick={() => onSelectTask(task.id)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] text-[#9CA3AF] shrink-0">
                              {task.taskKey}
                            </span>
                            <span
                              className={cn(
                                "truncate font-medium group-hover:text-[#5148C9] transition-colors",
                                task.status === "DONE"
                                  ? "line-through text-[#9CA3AF]"
                                  : "text-[#20232B]"
                              )}
                            >
                              {task.title}
                            </span>
                          </div>
                          <div className="mt-0.5 flex items-center gap-2.5 text-[11px] text-[#9CA3AF]">
                            {hasSubtasks && (
                              <span className="inline-flex items-center gap-1 text-[#737987]">
                                <GitBranch className="h-3 w-3" />
                                {doneSubs}/{task.subtasks.length}
                              </span>
                            )}
                            {task._count.comments > 0 && (
                              <span className="inline-flex items-center gap-0.5">
                                <MessageSquare className="h-3 w-3" />
                                {task._count.comments}
                              </span>
                            )}
                            {task._count.attachments > 0 && (
                              <span className="inline-flex items-center gap-0.5">
                                <Paperclip className="h-3 w-3" />
                                {task._count.attachments}
                              </span>
                            )}
                          </div>
                        </button>
                      </div>
                    </td>

                    {/* Project */}
                    {showProjectColumn && (
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center gap-1.5 text-xs text-[#525866] whitespace-nowrap">
                          <span
                            className="h-2 w-2 rounded-[2px]"
                            style={{ backgroundColor: task.project.color }}
                          />
                          {task.project.name}
                        </span>
                      </td>
                    )}

                    {/* Assignee */}
                    <td className="py-2.5 px-3">
                      {task.assignee ? (
                        <div className="flex items-center gap-2">
                          <UserAvatar
                            name={task.assignee.name}
                            avatarUrl={task.assignee.avatarUrl}
                            size="xs"
                          />
                          <span className="text-xs text-[#374151] whitespace-nowrap">
                            {task.assignee.name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-[#9CA3AF]">Unassigned</span>
                      )}
                    </td>

                    {/* Priority */}
                    <td className="py-2.5 px-3">
                      <PriorityBadge priority={task.priority} />
                    </td>

                    {/* Inline Status Select */}
                    <td className="py-2.5 px-3">
                      <Select
                        value={task.status}
                        onValueChange={(v) =>
                          handleStatusChange(task.id, v as TaskStatus)
                        }
                      >
                        <SelectTrigger className="h-7 w-[124px] text-xs px-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="TODO">To Do</SelectItem>
                          <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                          <SelectItem value="IN_REVIEW">In Review</SelectItem>
                          <SelectItem value="DONE">Done</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>

                    {/* Due Date */}
                    <td className="py-2.5 px-3">
                      <span
                        className={cn(
                          "text-xs whitespace-nowrap",
                          overdue
                            ? "font-semibold text-[#EF4444]"
                            : "text-[#525866]"
                        )}
                      >
                        {formatCompactDate(task.dueDate)}
                      </span>
                    </td>

                    {/* Progress */}
                    <td className="py-2.5 pl-3 pr-4">
                      <div className="flex items-center gap-2">
                        <Progress
                          value={getDisplayTaskProgress(task)}
                          className="h-1.5 flex-1"
                        />
                        <span className="text-[11px] font-medium text-[#525866] w-8 text-right">
                          {getDisplayTaskProgress(task)}%
                        </span>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded Nested Subtask Rows */}
                  {hasSubtasks &&
                    isExpanded &&
                    task.subtasks.map((sub) => {
                      const subDone = sub.status === "DONE";
                      const subOverdue = isTaskOverdue(sub.dueDate, sub.status);
                      return (
                        <tr
                          key={sub.id}
                          className="bg-[#FAFBFC] hover:bg-[#F3F5F9] transition-colors"
                        >
                          <td className="py-2 pl-11 pr-3">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  handleStatusChange(
                                    sub.id,
                                    sub.status === "TODO"
                                      ? "IN_PROGRESS"
                                      : subDone
                                      ? "TODO"
                                      : "DONE",
                                    true,
                                    task.id
                                  )
                                }
                                className="shrink-0 text-[#737987] hover:text-[#635BDB]"
                              >
                                {subDone ? (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-[#16A34A]" />
                                ) : (
                                  <Circle className="h-3.5 w-3.5" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => onSelectTask(sub.id)}
                                className="flex items-center gap-1.5 text-left min-w-0"
                              >
                                <span className="font-mono text-[10.5px] text-[#9CA3AF]">
                                  {sub.taskKey}
                                </span>
                                <span
                                  className={cn(
                                    "truncate text-[12.5px]",
                                    subDone
                                      ? "line-through text-[#9CA3AF]"
                                      : "text-[#374151]"
                                  )}
                                >
                                  {sub.title}
                                </span>
                              </button>
                            </div>
                          </td>
                          {showProjectColumn && (
                            <td className="py-2 px-3 text-[11px] text-[#9CA3AF]">
                              Subtask
                            </td>
                          )}
                          <td className="py-2 px-3">
                            {sub.assignee ? (
                              <div className="flex items-center gap-1.5">
                                <UserAvatar
                                  name={sub.assignee.name}
                                  avatarUrl={sub.assignee.avatarUrl}
                                  size="xs"
                                />
                                <span className="text-[11.5px] text-[#525866]">
                                  {sub.assignee.name}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[11px] text-[#9CA3AF]">—</span>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            <PriorityBadge priority={sub.priority} />
                          </td>
                          <td className="py-2 px-3">
                            <Select
                              value={sub.status}
                              onValueChange={(v) =>
                                handleStatusChange(
                                  sub.id,
                                  v as TaskStatus,
                                  true,
                                  task.id
                                )
                              }
                            >
                              <SelectTrigger className="h-6 w-[116px] text-[11px] px-2">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="TODO">To Do</SelectItem>
                                <SelectItem value="IN_PROGRESS">
                                  In Progress
                                </SelectItem>
                                <SelectItem value="IN_REVIEW">
                                  In Review
                                </SelectItem>
                                <SelectItem value="DONE">Done</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={cn(
                                "text-[11.5px]",
                                subOverdue
                                  ? "font-medium text-[#EF4444]"
                                  : "text-[#737987]"
                              )}
                            >
                              {formatCompactDate(sub.dueDate)}
                            </span>
                          </td>
                          <td className="py-2 pl-3 pr-4 text-right text-[11px] text-[#737987]">
                            {getStatusProgressScore(sub.status)}%
                          </td>
                        </tr>
                      );
                    })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-[#EAECF0] px-4 py-2.5 text-xs text-[#737987]">
          <span>
            Showing {(currentPage - 1) * PAGE_SIZE + 1}–
            {Math.min(currentPage * PAGE_SIZE, tasks.length)} of {tasks.length}{" "}
            tasks
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="px-2 font-medium text-[#20232B]">
              Page {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
