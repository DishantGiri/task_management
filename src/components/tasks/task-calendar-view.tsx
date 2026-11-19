"use client";

import { useState } from "react";
import {
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { TaskListItem } from "@/types";
import { cn, isTaskOverdue } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PriorityBadge } from "@/components/shared/badges";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function TaskCalendarView({
  tasks,
  onSelectTask,
}: {
  tasks: TaskListItem[];
  onSelectTask: (id: string) => void;
}) {
  const [mode, setMode] = useState<"month" | "week">("month");
  const [cursorDate, setCursorDate] = useState(() => new Date());

  const rangeStart =
    mode === "month"
      ? startOfWeek(startOfMonth(cursorDate), { weekStartsOn: 1 })
      : startOfWeek(cursorDate, { weekStartsOn: 1 });
  const rangeEnd =
    mode === "month"
      ? endOfWeek(endOfMonth(cursorDate), { weekStartsOn: 1 })
      : endOfWeek(cursorDate, { weekStartsOn: 1 });

  const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });

  const goPrev = () =>
    setCursorDate((d) => (mode === "month" ? subMonths(d, 1) : subWeeks(d, 1)));
  const goNext = () =>
    setCursorDate((d) => (mode === "month" ? addMonths(d, 1) : addWeeks(d, 1)));

  const tasksWithDates = tasks.filter((t) => !!t.dueDate);

  return (
    <div className="rounded-lg border border-[#EAECF0] bg-white shadow-subtle overflow-hidden">
      {/* Calendar Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EAECF0] px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-[15px] font-semibold text-[#20232B] min-w-[150px]">
            {mode === "month"
              ? format(cursorDate, "MMMM yyyy")
              : `${format(rangeStart, "MMM d")} – ${format(rangeEnd, "MMM d, yyyy")}`}
          </h2>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={goPrev}
              aria-label="Previous period"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setCursorDate(new Date())}
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={goNext}
              aria-label="Next period"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="inline-flex rounded-md border border-[#EAECF0] bg-[#F7F8FA] p-0.5">
          <button
            type="button"
            onClick={() => setMode("month")}
            className={cn(
              "rounded-[4px] px-2.5 py-1 text-xs font-medium transition-colors",
              mode === "month"
                ? "bg-white text-[#20232B] shadow-subtle"
                : "text-[#737987] hover:text-[#20232B]"
            )}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setMode("week")}
            className={cn(
              "rounded-[4px] px-2.5 py-1 text-xs font-medium transition-colors",
              mode === "week"
                ? "bg-white text-[#20232B] shadow-subtle"
                : "text-[#737987] hover:text-[#20232B]"
            )}
          >
            Weekly
          </button>
        </div>
      </div>

      {/* Weekday Labels */}
      <div className="grid grid-cols-7 border-b border-[#EAECF0] bg-[#F7F8FA]">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="py-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-[#737987] border-r last:border-r-0 border-[#EAECF0]"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Day Grid */}
      <div className="grid grid-cols-7 divide-x divide-y divide-[#EAECF0]">
        {days.map((day) => {
          const dayTasks = tasksWithDates.filter(
            (t) => t.dueDate && isSameDay(new Date(t.dueDate), day)
          );
          const outside = mode === "month" && !isSameMonth(day, cursorDate);
          const today = isToday(day);

          return (
            <div
              key={day.toISOString()}
              className={cn(
                "p-2 transition-colors",
                mode === "month" ? "min-h-[112px]" : "min-h-[340px]",
                outside ? "bg-[#FAFBFC]" : "bg-white"
              )}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span
                  className={cn(
                    "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                    today
                      ? "bg-[#635BDB] text-white"
                      : outside
                      ? "text-[#9CA3AF]"
                      : "text-[#374151]"
                  )}
                >
                  {format(day, "d")}
                </span>
                {dayTasks.length > 0 && (
                  <span className="text-[10px] font-medium text-[#9CA3AF]">
                    {dayTasks.length}
                  </span>
                )}
              </div>

              <div className="space-y-1">
                {dayTasks.slice(0, mode === "month" ? 3 : 12).map((task) => {
                  const overdue = isTaskOverdue(task.dueDate, task.status);
                  return (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => onSelectTask(task.id)}
                      className={cn(
                        "w-full rounded-[4px] border px-1.5 py-1 text-left text-[11px] transition-colors hover:border-[#635BDB]",
                        task.status === "DONE"
                          ? "border-emerald-200 bg-emerald-50/70 text-emerald-800 line-through"
                          : overdue
                          ? "border-red-200 bg-red-50/80 text-red-800"
                          : "border-[#EAECF0] bg-[#F7F8FA] text-[#20232B]"
                      )}
                    >
                      <div className="flex items-center gap-1">
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: task.project.color }}
                        />
                        <span className="truncate font-medium">
                          {task.title}
                        </span>
                      </div>
                      {mode === "week" && (
                        <div className="mt-1 flex items-center justify-between gap-1">
                          <span className="font-mono text-[10px] text-[#737987]">
                            {task.taskKey}
                          </span>
                          <PriorityBadge
                            priority={task.priority}
                            showLabel={false}
                          />
                        </div>
                      )}
                    </button>
                  );
                })}
                {mode === "month" && dayTasks.length > 3 && (
                  <p className="px-1 text-[10.5px] font-medium text-[#635BDB]">
                    +{dayTasks.length - 3} more
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
