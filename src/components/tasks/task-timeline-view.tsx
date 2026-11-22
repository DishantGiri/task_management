"use client";

import { useMemo } from "react";
import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  format,
  isToday,
  startOfDay,
  subDays,
} from "date-fns";
import { Link2 } from "lucide-react";
import type { TaskListItem } from "@/types";
import { cn, getDisplayTaskProgress, STATUS_CONFIG } from "@/lib/utils";
import { UserAvatar } from "@/components/ui/avatar";

export function TaskTimelineView({
  tasks,
  onSelectTask,
}: {
  tasks: TaskListItem[];
  onSelectTask: (id: string) => void;
}) {
  const { timelineStart, days, rows } = useMemo(() => {
    const today = startOfDay(new Date());
    let minDate = subDays(today, 5);
    let maxDate = addDays(today, 21);

    const parsedRows = tasks.map((t) => {
      const start = t.startDate
        ? startOfDay(new Date(t.startDate))
        : t.dueDate
        ? subDays(startOfDay(new Date(t.dueDate)), 3)
        : today;
      const end = t.dueDate
        ? startOfDay(new Date(t.dueDate))
        : addDays(start, 4);
      const safeEnd = end < start ? start : end;

      if (start < minDate) minDate = subDays(start, 2);
      if (safeEnd > maxDate) maxDate = addDays(safeEnd, 4);

      return { task: t, start, end: safeEnd };
    });

    // Clamp total span to a crisp readable 45-day window max
    const totalDays = Math.min(
      45,
      Math.max(21, differenceInCalendarDays(maxDate, minDate) + 1)
    );
    const intervalDays = eachDayOfInterval({
      start: minDate,
      end: addDays(minDate, totalDays - 1),
    });

    return {
      timelineStart: minDate,
      days: intervalDays,
      rows: parsedRows,
    };
  }, [tasks]);

  const DAY_WIDTH = 38;
  const totalWidth = days.length * DAY_WIDTH;

  if (tasks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[#D9DEE7] bg-white py-14 text-center">
        <p className="text-sm font-medium text-[#20232B]">
          No scheduled tasks for timeline
        </p>
        <p className="mt-1 text-xs text-[#737987]">
          Add start and due dates to tasks to visualize project timelines and
          dependencies.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#EAECF0] bg-white shadow-subtle overflow-hidden">
      <div className="flex overflow-x-auto">
        {/* Left Sticky Task Column */}
        <div className="w-[270px] shrink-0 border-r border-[#EAECF0] bg-white sticky left-0 z-10">
          <div className="h-11 flex items-center px-4 border-b border-[#EAECF0] bg-[#F7F8FA] text-[11px] font-semibold uppercase tracking-wider text-[#737987]">
            Task &amp; Dependencies
          </div>
          <div className="divide-y divide-[#EAECF0]">
            {rows.map(({ task }) => (
              <button
                key={task.id}
                type="button"
                onClick={() => onSelectTask(task.id)}
                className="flex h-12 w-full items-center gap-2.5 px-4 text-left hover:bg-[#F7F8FA] transition-colors"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                  style={{ backgroundColor: task.project.color }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[10.5px] text-[#9CA3AF]">
                      {task.taskKey}
                    </span>
                    <span className="truncate text-xs font-medium text-[#20232B]">
                      {task.title}
                    </span>
                  </div>
                  {task.dependencies.length > 0 && (
                    <div className="flex items-center gap-1 text-[10px] text-amber-700 mt-0.5">
                      <Link2 className="h-2.5 w-2.5" />
                      <span>
                        Depends on{" "}
                        {task.dependencies
                          .map((d) => d.dependsOn.taskKey)
                          .join(", ")}
                      </span>
                    </div>
                  )}
                </div>
                {task.assignee && (
                  <UserAvatar
                    name={task.assignee.name}
                    avatarUrl={task.assignee.avatarUrl}
                    size="xs"
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Right Timeline Grid */}
        <div style={{ width: totalWidth }} className="shrink-0">
          {/* Date Header */}
          <div className="flex h-11 border-b border-[#EAECF0] bg-[#F7F8FA]">
            {days.map((day) => {
              const today = isToday(day);
              const isFirstOfMonth = day.getDate() === 1;
              return (
                <div
                  key={day.toISOString()}
                  style={{ width: DAY_WIDTH }}
                  className={cn(
                    "shrink-0 flex flex-col items-center justify-center border-r border-[#EAECF0]/70 text-[10px]",
                    today
                      ? "bg-[#F0EFFF] text-[#5148C9] font-semibold"
                      : "text-[#737987]"
                  )}
                >
                  <span className="text-[9px] uppercase">
                    {isFirstOfMonth ? format(day, "MMM") : format(day, "EEE").slice(0, 2)}
                  </span>
                  <span>{format(day, "d")}</span>
                </div>
              );
            })}
          </div>

          {/* Gantt Rows */}
          <div className="divide-y divide-[#EAECF0] relative">
            {rows.map(({ task, start, end }) => {
              const offsetDays = Math.max(
                0,
                differenceInCalendarDays(start, timelineStart)
              );
              const spanDays = Math.max(
                1,
                differenceInCalendarDays(end, start) + 1
              );
              const leftPx = offsetDays * DAY_WIDTH + 3;
              const widthPx = Math.max(
                DAY_WIDTH - 6,
                Math.min(
                  spanDays * DAY_WIDTH - 6,
                  totalWidth - leftPx - 4
                )
              );

              const statusColor = STATUS_CONFIG[task.status].color;

              return (
                <div
                  key={task.id}
                  className="relative h-12 flex items-center"
                >
                  {/* Day vertical guidelines */}
                  <div className="absolute inset-0 flex pointer-events-none">
                    {days.map((day) => (
                      <div
                        key={day.toISOString()}
                        style={{ width: DAY_WIDTH }}
                        className={cn(
                          "h-full border-r border-[#F1F3F7]",
                          isToday(day) && "bg-[#F0EFFF]/45"
                        )}
                      />
                    ))}
                  </div>

                  {/* Task Bar */}
                  <button
                    type="button"
                    onClick={() => onSelectTask(task.id)}
                    style={{
                      left: leftPx,
                      width: widthPx,
                      borderColor: statusColor,
                    }}
                    className="absolute h-7 rounded-[5px] border bg-white shadow-subtle overflow-hidden text-left group hover:shadow-card transition-shadow"
                    title={`${task.taskKey}: ${task.title} (${format(start, "MMM d")} – ${format(end, "MMM d")})`}
                  >
                    <div
                      className="absolute inset-y-0 left-0 opacity-20"
                      style={{
                        width: `${Math.max(12, getDisplayTaskProgress(task))}%`,
                        backgroundColor: statusColor,
                      }}
                    />
                    <div className="relative flex h-full items-center justify-between px-2 gap-1">
                      <span className="truncate text-[11px] font-medium text-[#20232B]">
                        {task.title}
                      </span>
                      <span className="text-[10px] font-semibold text-[#525866] shrink-0">
                        {getDisplayTaskProgress(task)}%
                      </span>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
