"use client";

import { useMemo, useState } from "react";
import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  format,
  isSameDay,
  startOfDay,
  subDays,
} from "date-fns";
import { Ban, CheckCircle2, Link2 } from "lucide-react";
import type { TaskListItem } from "@/types";
import {
  cn,
  getDisplayTaskProgress,
  getServerNow,
  isTaskOverdue,
  STATUS_CONFIG,
} from "@/lib/utils";
import { UserAvatar } from "@/components/ui/avatar";

export interface TimelineMilestone {
  id: string;
  title: string;
  status: "UPCOMING" | "IN_PROGRESS" | "COMPLETED";
  dueDate: string | null;
  projectId: string;
  projectName?: string;
  projectColor?: string;
  progress?: number;
}

const DAY_WIDTH = 38;
const MILESTONE_ROW_HEIGHT = 44; // h-11
const TASK_ROW_HEIGHT = 48; // h-12

function buildOrthogonalPath(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number
): string {
  const targetX = toX - 3; // leave room for arrowhead tip
  const dirY = toY >= fromY ? 1 : -1;
  const r = 6;

  // Standard forward Finish-to-Start elbow connector
  if (targetX >= fromX + 18) {
    const midX = Math.round(fromX + Math.min(18, (targetX - fromX) / 2));
    if (Math.abs(toY - fromY) < 2) {
      return `M ${fromX} ${fromY} L ${targetX} ${toY}`;
    }
    const rSafe = Math.min(r, Math.abs(toY - fromY) / 2, Math.abs(midX - fromX));
    return [
      `M ${fromX} ${fromY}`,
      `L ${midX - rSafe} ${fromY}`,
      `Q ${midX} ${fromY} ${midX} ${fromY + dirY * rSafe}`,
      `L ${midX} ${toY - dirY * rSafe}`,
      `Q ${midX} ${toY} ${midX + rSafe} ${toY}`,
      `L ${targetX} ${toY}`,
    ].join(" ");
  }

  // Wrap-around connector when dependent starts before (or right at) blocker's end
  const exitX = fromX + 12;
  const entryX = Math.max(4, targetX - 12);
  const midY =
    Math.abs(toY - fromY) >= TASK_ROW_HEIGHT
      ? fromY + dirY * (TASK_ROW_HEIGHT / 2)
      : fromY + dirY * 22;

  return [
    `M ${fromX} ${fromY}`,
    `L ${exitX} ${fromY}`,
    `L ${exitX} ${midY}`,
    `L ${entryX} ${midY}`,
    `L ${entryX} ${toY}`,
    `L ${targetX} ${toY}`,
  ].join(" ");
}

export function TaskTimelineView({
  tasks,
  milestones = [],
  onSelectTask,
}: {
  tasks: TaskListItem[];
  milestones?: TimelineMilestone[];
  onSelectTask: (id: string) => void;
}) {
  const serverToday = startOfDay(getServerNow());
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);

  const { timelineStart, days, rows, milestoneRows } = useMemo(() => {
    const today = startOfDay(getServerNow());
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

      const activeBlockers =
        t.status !== "DONE"
          ? t.dependencies.filter((d) => d.dependsOn.status !== "DONE")
          : [];
      const isBlocked = activeBlockers.length > 0;

      return {
        task: t,
        start,
        end: safeEnd,
        activeBlockers,
        isBlocked,
      };
    });

    const parsedMilestones = milestones
      .filter((m) => Boolean(m.dueDate))
      .map((m) => {
        const targetDate = startOfDay(new Date(m.dueDate!));
        if (targetDate < minDate) minDate = subDays(targetDate, 2);
        if (targetDate > maxDate) maxDate = addDays(targetDate, 4);
        return { milestone: m, date: targetDate };
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    // Clamp total span to a crisp readable 60-day window max
    const totalDays = Math.min(
      60,
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
      milestoneRows: parsedMilestones,
    };
  }, [tasks, milestones]);

  const totalWidth = days.length * DAY_WIDTH;
  const totalHeight =
    milestoneRows.length * MILESTONE_ROW_HEIGHT + rows.length * TASK_ROW_HEIGHT;

  // Precompute bar geometry & dependency connector edges
  const { barCoords, dependencyEdges, hasAnyDependency, hasAnyBlocked } =
    useMemo(() => {
      const coords = new Map<
        string,
        { leftPx: number; widthPx: number; centerY: number }
      >();

      rows.forEach(({ task, start, end }, idx) => {
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
          Math.min(spanDays * DAY_WIDTH - 6, totalWidth - leftPx - 4)
        );
        const centerY =
          milestoneRows.length * MILESTONE_ROW_HEIGHT +
          idx * TASK_ROW_HEIGHT +
          TASK_ROW_HEIGHT / 2;

        coords.set(task.id, { leftPx, widthPx, centerY });
      });

      const edges: {
        id: string;
        fromTaskId: string;
        toTaskId: string;
        fromKey: string;
        toKey: string;
        fromX: number;
        fromY: number;
        toX: number;
        toY: number;
        isBlocking: boolean;
      }[] = [];

      let anyDep = false;
      let anyBlocked = false;

      for (const { task, isBlocked } of rows) {
        if (isBlocked) anyBlocked = true;
        if (task.dependencies.length > 0) anyDep = true;

        const targetCoord = coords.get(task.id);
        if (!targetCoord) continue;

        for (const dep of task.dependencies) {
          const sourceCoord = coords.get(dep.dependsOnId);
          if (!sourceCoord) continue;
          const isBlocking =
            task.status !== "DONE" && dep.dependsOn.status !== "DONE";
          edges.push({
            id: `${dep.dependsOnId}->${task.id}`,
            fromTaskId: dep.dependsOnId,
            toTaskId: task.id,
            fromKey: dep.dependsOn.taskKey,
            toKey: task.taskKey,
            fromX: sourceCoord.leftPx + sourceCoord.widthPx,
            fromY: sourceCoord.centerY,
            toX: targetCoord.leftPx,
            toY: targetCoord.centerY,
            isBlocking,
          });
        }
      }

      return {
        barCoords: coords,
        dependencyEdges: edges,
        hasAnyDependency: anyDep,
        hasAnyBlocked: anyBlocked,
      };
    }, [rows, milestoneRows.length, timelineStart, totalWidth]);

  if (tasks.length === 0 && milestoneRows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[#D9DEE7] bg-white py-14 text-center">
        <p className="text-sm font-medium text-[#20232B]">
          No scheduled tasks or milestones for timeline
        </p>
        <p className="mt-1 text-xs text-[#737987]">
          Add start/due dates to tasks or target dates to milestones to
          visualize project timelines.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#EAECF0] bg-white shadow-subtle overflow-hidden">
      <div className="flex overflow-x-auto">
        {/* Left Sticky Task & Milestone Column */}
        <div className="w-[290px] shrink-0 border-r border-[#EAECF0] bg-white sticky left-0 z-10">
          <div className="h-11 flex items-center justify-between px-4 border-b border-[#EAECF0] bg-[#F7F8FA] text-[11px] font-semibold uppercase tracking-wider text-[#737987]">
            <span>Milestones &amp; Tasks</span>
            {hasAnyBlocked && (
              <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-1.5 py-0.5 text-[9.5px] font-semibold normal-case tracking-normal text-red-700">
                <Ban className="h-2.5 w-2.5" />
                {rows.filter((r) => r.isBlocked).length} blocked
              </span>
            )}
          </div>
          <div>
            {/* Milestone Labels */}
            {milestoneRows.map(({ milestone, date }) => {
              const overdue =
                milestone.status !== "COMPLETED" &&
                isTaskOverdue(milestone.dueDate, "TODO");
              const diamondColor =
                milestone.status === "COMPLETED"
                  ? "bg-[#16A34A]"
                  : overdue
                  ? "bg-[#EF4444]"
                  : "bg-[#635BDB]";

              return (
                <div
                  key={`ms-label-${milestone.id}`}
                  className="flex h-11 w-full items-center gap-2.5 border-b border-[#EAECF0] bg-[#FBFBFF] px-4 text-left"
                >
                  <span
                    className={cn(
                      "h-2.5 w-2.5 shrink-0 rotate-45 rounded-[1.5px]",
                      diamondColor
                    )}
                    title="Milestone"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="rounded bg-[#F0EFFF] px-1 py-0.2 text-[9.5px] font-semibold uppercase tracking-wide text-[#5148C9] shrink-0">
                        Milestone
                      </span>
                      <span className="truncate text-xs font-semibold text-[#20232B]">
                        {milestone.title}
                      </span>
                    </div>
                    <p className="text-[10px] text-[#737987] truncate">
                      {format(date, "MMM d, yyyy")}
                      {milestone.projectName
                        ? ` · ${milestone.projectName}`
                        : ""}
                    </p>
                  </div>
                </div>
              );
            })}

            {/* Task Labels */}
            {rows.map(({ task, activeBlockers, isBlocked }) => {
              const allDepsDone =
                task.dependencies.length > 0 && activeBlockers.length === 0;

              return (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => onSelectTask(task.id)}
                  onMouseEnter={() => setHoveredTaskId(task.id)}
                  onMouseLeave={() => setHoveredTaskId(null)}
                  className={cn(
                    "flex h-12 w-full items-center gap-2.5 border-b border-[#EAECF0] px-4 text-left transition-colors",
                    isBlocked
                      ? "bg-red-50/40 hover:bg-red-50/75"
                      : "hover:bg-[#F7F8FA]"
                  )}
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                    style={{
                      backgroundColor: isBlocked
                        ? "#EF4444"
                        : task.project.color,
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[10.5px] text-[#9CA3AF] shrink-0">
                        {task.taskKey}
                      </span>
                      <span className="truncate text-xs font-medium text-[#20232B]">
                        {task.title}
                      </span>
                      {isBlocked && (
                        <span className="inline-flex shrink-0 items-center gap-0.5 rounded border border-red-200 bg-red-50 px-1 py-0.2 text-[9.5px] font-semibold text-red-700">
                          <Ban className="h-2.5 w-2.5" />
                          Blocked
                        </span>
                      )}
                    </div>
                    {isBlocked ? (
                      <div className="flex items-center gap-1 text-[10px] text-red-600 mt-0.5 truncate">
                        <Link2 className="h-2.5 w-2.5 shrink-0" />
                        <span className="truncate">
                          Blocked by{" "}
                          {activeBlockers
                            .map((d) => d.dependsOn.taskKey)
                            .join(", ")}
                        </span>
                      </div>
                    ) : allDepsDone ? (
                      <div className="flex items-center gap-1 text-[10px] text-emerald-700 mt-0.5 truncate">
                        <CheckCircle2 className="h-2.5 w-2.5 shrink-0" />
                        <span className="truncate">
                          Unblocked ·{" "}
                          {task.dependencies
                            .map((d) => d.dependsOn.taskKey)
                            .join(", ")}
                        </span>
                      </div>
                    ) : null}
                  </div>
                  {task.assignee && (
                    <UserAvatar
                      name={task.assignee.name}
                      avatarUrl={task.assignee.avatarUrl}
                      size="xs"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Timeline Grid */}
        <div style={{ width: totalWidth }} className="shrink-0">
          {/* Date Header */}
          <div className="flex h-11 border-b border-[#EAECF0] bg-[#F7F8FA]">
            {days.map((day) => {
              const today = isSameDay(day, serverToday);
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
                    {isFirstOfMonth
                      ? format(day, "MMM")
                      : format(day, "EEE").slice(0, 2)}
                  </span>
                  <span>{format(day, "d")}</span>
                </div>
              );
            })}
          </div>

          {/* Gantt Rows + SVG Dependency Arrows */}
          <div className="relative" style={{ minHeight: totalHeight }}>
            {/* Vertical dashed milestone guide lines across entire chart */}
            {milestoneRows.map(({ milestone, date }) => {
              const offsetDays = differenceInCalendarDays(date, timelineStart);
              if (offsetDays < 0 || offsetDays >= days.length) return null;
              const centerX = offsetDays * DAY_WIDTH + DAY_WIDTH / 2;
              const overdue =
                milestone.status !== "COMPLETED" &&
                isTaskOverdue(milestone.dueDate, "TODO");
              const lineColor =
                milestone.status === "COMPLETED"
                  ? "border-emerald-300/80"
                  : overdue
                  ? "border-red-300/80"
                  : "border-[#635BDB]/35";
              return (
                <div
                  key={`ms-guide-${milestone.id}`}
                  style={{ left: centerX }}
                  className={cn(
                    "pointer-events-none absolute top-0 bottom-0 z-[1] border-l border-dashed",
                    lineColor
                  )}
                />
              );
            })}

            {/* SVG Dependency Connectors (Finish-to-Start arrows) */}
            {dependencyEdges.length > 0 && (
              <svg
                width={totalWidth}
                height={totalHeight}
                className="pointer-events-none absolute inset-0 z-[3] overflow-visible"
              >
                <defs>
                  <marker
                    id="dep-arrow-blocked"
                    viewBox="0 0 10 10"
                    refX="7"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#EF4444" />
                  </marker>
                  <marker
                    id="dep-arrow-done"
                    viewBox="0 0 10 10"
                    refX="7"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#94A3B8" />
                  </marker>
                </defs>

                {dependencyEdges.map((edge) => {
                  const isHighlighted =
                    hoveredTaskId !== null &&
                    (edge.fromTaskId === hoveredTaskId ||
                      edge.toTaskId === hoveredTaskId);
                  const isDimmed = hoveredTaskId !== null && !isHighlighted;
                  const pathD = buildOrthogonalPath(
                    edge.fromX,
                    edge.fromY,
                    edge.toX,
                    edge.toY
                  );
                  const stroke = edge.isBlocking ? "#EF4444" : "#94A3B8";

                  return (
                    <g
                      key={edge.id}
                      style={{
                        opacity: isDimmed ? 0.2 : isHighlighted ? 1 : 0.85,
                        transition: "opacity 150ms ease",
                      }}
                    >
                      <circle cx={edge.fromX} cy={edge.fromY} r={2.5} fill={stroke} />
                      <path
                        d={pathD}
                        fill="none"
                        stroke={stroke}
                        strokeWidth={isHighlighted ? 2.2 : 1.5}
                        strokeDasharray={edge.isBlocking ? "4 3" : undefined}
                        markerEnd={
                          edge.isBlocking
                            ? "url(#dep-arrow-blocked)"
                            : "url(#dep-arrow-done)"
                        }
                      />
                    </g>
                  );
                })}
              </svg>
            )}

            {/* Diamond Milestone Rows */}
            {milestoneRows.map(({ milestone, date }) => {
              const offsetDays = Math.max(
                0,
                Math.min(
                  days.length - 1,
                  differenceInCalendarDays(date, timelineStart)
                )
              );
              const centerX = offsetDays * DAY_WIDTH + DAY_WIDTH / 2;
              const overdue =
                milestone.status !== "COMPLETED" &&
                isTaskOverdue(milestone.dueDate, "TODO");
              const diamondStyles =
                milestone.status === "COMPLETED"
                  ? "bg-[#16A34A] border-emerald-700 ring-2 ring-emerald-200"
                  : overdue
                  ? "bg-[#EF4444] border-red-700 ring-2 ring-red-200"
                  : "bg-[#635BDB] border-[#4338CA] ring-2 ring-[#E0DEFF]";

              return (
                <div
                  key={`ms-row-${milestone.id}`}
                  className="relative h-11 flex items-center border-b border-[#EAECF0] bg-[#FBFBFF]"
                >
                  {/* Day vertical guidelines */}
                  <div className="absolute inset-0 flex pointer-events-none">
                    {days.map((day) => (
                      <div
                        key={day.toISOString()}
                        style={{ width: DAY_WIDTH }}
                        className={cn(
                          "h-full border-r border-[#F1F3F7]",
                          isSameDay(day, serverToday) && "bg-[#F0EFFF]/45"
                        )}
                      />
                    ))}
                  </div>

                  {/* Diamond Marker + Inline Label */}
                  <div
                    style={{ left: centerX - 8 }}
                    className="absolute z-[2] flex items-center gap-2.5"
                    title={`Milestone: ${milestone.title} · Target: ${format(
                      date,
                      "MMM d, yyyy"
                    )}${
                      milestone.progress !== undefined
                        ? ` · ${milestone.progress}% complete`
                        : ""
                    }`}
                  >
                    <div
                      className={cn(
                        "h-4 w-4 shrink-0 rotate-45 rounded-[2px] border shadow-sm",
                        diamondStyles
                      )}
                    />
                    <span className="whitespace-nowrap rounded-md border border-[#E4E2FF] bg-white/95 px-2 py-0.5 text-[11px] font-semibold text-[#20232B] shadow-subtle">
                      {milestone.title}
                      <span className="ml-1.5 font-normal text-[#737987]">
                        {format(date, "MMM d")}
                      </span>
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Task Bars */}
            {rows.map(({ task, start, end, activeBlockers, isBlocked }) => {
              const coord = barCoords.get(task.id);
              const leftPx = coord?.leftPx ?? 3;
              const widthPx = coord?.widthPx ?? DAY_WIDTH - 6;
              const statusColor = isBlocked
                ? "#EF4444"
                : STATUS_CONFIG[task.status].color;

              const tooltip = [
                `${task.taskKey}: ${task.title} (${format(
                  start,
                  "MMM d"
                )} – ${format(end, "MMM d")})`,
                isBlocked
                  ? `Blocked by: ${activeBlockers
                      .map((d) => `${d.dependsOn.taskKey} (${d.dependsOn.title})`)
                      .join(", ")}`
                  : null,
              ]
                .filter(Boolean)
                .join("\n");

              return (
                <div
                  key={task.id}
                  className={cn(
                    "relative h-12 flex items-center border-b border-[#EAECF0]",
                    isBlocked && "bg-red-50/20"
                  )}
                >
                  {/* Day vertical guidelines */}
                  <div className="absolute inset-0 flex pointer-events-none">
                    {days.map((day) => (
                      <div
                        key={day.toISOString()}
                        style={{ width: DAY_WIDTH }}
                        className={cn(
                          "h-full border-r border-[#F1F3F7]",
                          isSameDay(day, serverToday) && "bg-[#F0EFFF]/45"
                        )}
                      />
                    ))}
                  </div>

                  {/* Task Bar */}
                  <button
                    type="button"
                    onClick={() => onSelectTask(task.id)}
                    onMouseEnter={() => setHoveredTaskId(task.id)}
                    onMouseLeave={() => setHoveredTaskId(null)}
                    style={{
                      left: leftPx,
                      width: widthPx,
                      borderColor: statusColor,
                      backgroundImage: isBlocked
                        ? "repeating-linear-gradient(-45deg, rgba(239, 68, 68, 0.08), rgba(239, 68, 68, 0.08) 6px, transparent 6px, transparent 12px)"
                        : undefined,
                    }}
                    className={cn(
                      "absolute z-[2] h-7 rounded-[5px] border bg-white shadow-subtle overflow-hidden text-left group hover:shadow-card transition-shadow",
                      isBlocked && "border-dashed border-red-500 bg-red-50/60"
                    )}
                    title={tooltip}
                  >
                    {!isBlocked && (
                      <div
                        className="absolute inset-y-0 left-0 opacity-20"
                        style={{
                          width: `${Math.max(12, getDisplayTaskProgress(task))}%`,
                          backgroundColor: statusColor,
                        }}
                      />
                    )}
                    <div className="relative flex h-full items-center justify-between px-2 gap-1.5">
                      <div className="flex items-center gap-1 min-w-0">
                        {isBlocked && (
                          <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-red-600 px-1 py-0.2 text-[9px] font-semibold uppercase tracking-wide text-white">
                            <Ban className="h-2.5 w-2.5" />
                            {widthPx >= 115 && "Blocked"}
                          </span>
                        )}
                        <span
                          className={cn(
                            "truncate text-[11px] font-medium",
                            isBlocked ? "text-red-900" : "text-[#20232B]"
                          )}
                        >
                          {task.title}
                        </span>
                      </div>
                      <span
                        className={cn(
                          "text-[10px] font-semibold shrink-0",
                          isBlocked ? "text-red-700" : "text-[#525866]"
                        )}
                      >
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

      {/* Legend */}
      {(milestoneRows.length > 0 || hasAnyDependency || hasAnyBlocked) && (
        <div className="flex flex-wrap items-center gap-4 border-t border-[#EAECF0] bg-[#FAFBFC] px-4 py-2 text-[11px] text-[#737987]">
          {milestoneRows.length > 0 && (
            <>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rotate-45 rounded-[1px] bg-[#635BDB]" />
                Upcoming Milestone
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rotate-45 rounded-[1px] bg-[#16A34A]" />
                Completed Milestone
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rotate-45 rounded-[1px] bg-[#EF4444]" />
                Overdue Milestone
              </span>
            </>
          )}
          {(hasAnyDependency || hasAnyBlocked) && (
            <>
              <span className="inline-flex items-center gap-1.5">
                <svg
                  width="24"
                  height="10"
                  viewBox="0 0 24 10"
                  className="shrink-0"
                  aria-hidden="true"
                >
                  <line
                    x1="0"
                    y1="5"
                    x2="17"
                    y2="5"
                    stroke="#EF4444"
                    strokeWidth="1.75"
                    strokeDasharray="3.5 2.5"
                  />
                  <polygon points="16,1.5 23,5 16,8.5" fill="#EF4444" />
                </svg>
                Blocking Dependency
              </span>
              <span className="inline-flex items-center gap-1.5">
                <svg
                  width="24"
                  height="10"
                  viewBox="0 0 24 10"
                  className="shrink-0"
                  aria-hidden="true"
                >
                  <line
                    x1="0"
                    y1="5"
                    x2="17"
                    y2="5"
                    stroke="#94A3B8"
                    strokeWidth="1.75"
                  />
                  <polygon points="16,1.5 23,5 16,8.5" fill="#94A3B8" />
                </svg>
                Resolved Dependency
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-flex items-center gap-0.5 rounded border border-dashed border-red-500 bg-red-50 px-1.5 py-0.2 text-[9.5px] font-semibold text-red-700">
                  <Ban className="h-2.5 w-2.5" />
                  Blocked
                </span>
                Blocked Task
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
