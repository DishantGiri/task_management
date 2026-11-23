"use client";

import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  addMonths,
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
} from "date-fns";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Columns3,
  FolderKanban,
  Grid,
  Users,
} from "lucide-react";
import type { TaskListItem } from "@/types";
import { cn, isTaskOverdue } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PriorityBadge, TaskStatusBadge } from "@/components/shared/badges";

const DAYS_OF_WEEK = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

interface CalendarDayCell {
  key: string;
  date: Date;
  label: string;
  isCurrentMonth: boolean;
  isTodayDate: boolean;
  tasks: TaskListItem[];
  hasOverdue: boolean;
}

interface DayTileProps {
  day: CalendarDayCell;
  isSelected: boolean;
  onHover: (key: string | null) => void;
  onSelect: (key: string) => void;
}

const DayTile: React.FC<DayTileProps> = ({
  day,
  isSelected,
  onHover,
  onSelect,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const count = day.tasks.length;
  const hasTasks = count > 0;

  return (
    <motion.button
      type="button"
      onClick={() => {
        if (day.isCurrentMonth && hasTasks) {
          onSelect(day.key);
        }
      }}
      className={cn(
        "relative flex items-center justify-center py-1 transition-colors border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#635BDB]/40",
        day.isCurrentMonth
          ? hasTasks
            ? "bg-[#F8F7FF] border-[#DFDCFF] hover:border-[#635BDB] hover:bg-[#F0EFFF] cursor-pointer"
            : "bg-white border-[#EAECF0] hover:bg-[#F7F8FA] hover:border-[#D5D9E2]"
          : "bg-[#FAFBFC] border-[#F1F3F7] opacity-45 cursor-default",
        day.isTodayDate &&
          day.isCurrentMonth &&
          "border-[#635BDB] bg-[#F0EFFF] ring-1 ring-[#635BDB]/25",
        isSelected &&
          "border-[#635BDB] bg-[#E8E6FF] ring-2 ring-[#635BDB]/30"
      )}
      style={{ height: "4.25rem", borderRadius: 16 }}
      onMouseEnter={() => {
        setIsHovered(true);
        if (hasTasks) onHover(day.key);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        onHover(null);
      }}
      id={`day-${day.key}`}
    >
      <motion.div className="flex flex-col items-center justify-center">
        {day.isCurrentMonth && (
          <span
            className={cn(
              "text-sm font-semibold",
              day.isTodayDate ? "text-[#5148C9]" : "text-[#20232B]"
            )}
          >
            {day.label}
          </span>
        )}
        {day.isCurrentMonth && day.isTodayDate && (
          <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#635BDB]">
            Today
          </span>
        )}
      </motion.div>

      {/* Resting task count badge */}
      {hasTasks && !isHovered && (
        <motion.div
          className={cn(
            "absolute bottom-1.5 right-1.5 flex size-5 items-center justify-center rounded-full p-1 text-[10px] font-bold text-white shadow-xs",
            day.hasOverdue ? "bg-[#EF4444]" : "bg-[#635BDB]"
          )}
          layoutId={`day-${day.key}-task-count`}
          style={{ borderRadius: 999 }}
        >
          {count}
        </motion.div>
      )}

      {/* Morphing hover count overlay */}
      <AnimatePresence>
        {hasTasks && isHovered && (
          <div className="absolute inset-0 flex size-full items-center justify-center">
            <motion.div
              className={cn(
                "flex size-10 items-center justify-center p-1 text-xs font-bold text-white shadow-md",
                day.hasOverdue ? "bg-[#EF4444]" : "bg-[#635BDB]"
              )}
              layoutId={`day-${day.key}-task-count`}
              style={{ borderRadius: 999 }}
            >
              {count}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.button>
  );
};

export function TaskCalendarView({
  tasks,
  onSelectTask,
}: {
  tasks: TaskListItem[];
  onSelectTask: (id: string) => void;
}) {
  const [cursorDate, setCursorDate] = useState(() => new Date());
  const [moreView, setMoreView] = useState(true);
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const tasksWithDates = useMemo(
    () => tasks.filter((t) => Boolean(t.dueDate)),
    [tasks]
  );

  const days = useMemo<CalendarDayCell[]>(() => {
    const start = startOfWeek(startOfMonth(cursorDate), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(cursorDate), { weekStartsOn: 0 });

    return eachDayOfInterval({ start, end }).map((date) => {
      const isCurrentMonth = isSameMonth(date, cursorDate);
      const dayTasks = tasksWithDates.filter(
        (t) => t.dueDate && isSameDay(new Date(t.dueDate), date)
      );
      const hasOverdue = dayTasks.some((t) =>
        isTaskOverdue(t.dueDate, t.status)
      );

      return {
        key: format(date, "yyyy-MM-dd"),
        date,
        label: format(date, "dd"),
        isCurrentMonth,
        isTodayDate: isToday(date),
        tasks: dayTasks,
        hasOverdue,
      };
    });
  }, [cursorDate, tasksWithDates]);

  const activeFocusDay = hoveredDay ?? selectedDay;

  const sortedTaskDays = useMemo(() => {
    const withTasks = days.filter((d) => d.isCurrentMonth && d.tasks.length > 0);
    if (!activeFocusDay) return withTasks;
    return [...withTasks].sort((a, b) => {
      if (a.key === activeFocusDay) return -1;
      if (b.key === activeFocusDay) return 1;
      return 0;
    });
  }, [days, activeFocusDay]);

  const monthTaskCount = useMemo(
    () =>
      days
        .filter((d) => d.isCurrentMonth)
        .reduce((sum, d) => sum + d.tasks.length, 0),
    [days]
  );

  const goPrev = () => {
    setSelectedDay(null);
    setHoveredDay(null);
    setCursorDate((d) => subMonths(d, 1));
  };

  const goNext = () => {
    setSelectedDay(null);
    setHoveredDay(null);
    setCursorDate((d) => addMonths(d, 1));
  };

  const goToday = () => {
    setSelectedDay(null);
    setHoveredDay(null);
    setCursorDate(new Date());
  };

  const handleToggleSelect = (key: string) => {
    setSelectedDay((prev) => (prev === key ? null : key));
    if (!moreView) setMoreView(true);
  };

  return (
    <div className="rounded-xl border border-[#EAECF0] bg-white p-5 sm:p-6 shadow-subtle">
      <AnimatePresence mode="wait">
        <motion.div
          className="relative mx-auto flex w-full flex-col items-start justify-center gap-7 lg:flex-row"
          layout
        >
          {/* Left: Interactive Calendar Grid */}
          <motion.div
            layout
            className={cn(
              "w-full transition-all",
              moreView ? "lg:w-[54%] max-w-xl" : "max-w-3xl mx-auto"
            )}
          >
            <motion.div
              key="calendar-view"
              className="flex w-full flex-col gap-4"
            >
              {/* Header */}
              <div className="flex flex-wrap w-full items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <motion.h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#20232B]">
                    {format(cursorDate, "MMM").toUpperCase()}{" "}
                    <span className="text-[#635BDB]/75 font-semibold">
                      {format(cursorDate, "yyyy")}
                    </span>
                  </motion.h2>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={goPrev}
                      aria-label="Previous month"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2.5 text-xs"
                      onClick={goToday}
                    >
                      Today
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={goNext}
                      aria-label="Next month"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Split / Grid Toggle */}
                <button
                  type="button"
                  onClick={() => setMoreView((v) => !v)}
                  title={
                    moreView ? "Switch to calendar only" : "Show schedule panel"
                  }
                  className="relative flex items-center gap-3 rounded-lg border border-[#E2E6EE] bg-[#F7F8FA] px-2 py-1.5 text-[#525866]"
                >
                  <Grid
                    className={cn(
                      "z-[2] h-4 w-4 transition-colors",
                      !moreView ? "text-[#635BDB]" : "text-[#737987]"
                    )}
                  />
                  <Columns3
                    className={cn(
                      "z-[2] h-4 w-4 transition-colors",
                      moreView ? "text-[#635BDB]" : "text-[#737987]"
                    )}
                  />
                  <div
                    className="absolute left-0 h-[78%] w-7 rounded-md bg-white shadow-subtle border border-[#EAECF0] transition-transform duration-300"
                    style={{
                      top: "50%",
                      transform: moreView
                        ? "translateY(-50%) translateX(32px)"
                        : "translateY(-50%) translateX(4px)",
                    }}
                  />
                </button>
              </div>

              {/* Weekday Headers */}
              <div className="grid grid-cols-7 gap-2">
                {DAYS_OF_WEEK.map((day) => (
                  <div
                    key={day}
                    className="rounded-xl border border-[#E4E2FF] bg-[#F0EFFF]/80 py-1.5 text-center text-[11px] font-semibold tracking-wider text-[#5148C9]"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-2">
                {days.map((day) => (
                  <DayTile
                    key={day.key}
                    day={day}
                    isSelected={selectedDay === day.key}
                    onHover={setHoveredDay}
                    onSelect={handleToggleSelect}
                  />
                ))}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-[#737987]">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#635BDB]" />
                    Scheduled tasks
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#EF4444]" />
                    Includes overdue
                  </span>
                </div>
                <span>
                  {monthTaskCount}{" "}
                  {monthTaskCount === 1 ? "task" : "tasks"} in{" "}
                  {format(cursorDate, "MMMM")}
                </span>
              </div>
            </motion.div>
          </motion.div>

          {/* Right: Animated Schedule / Deadlines Panel */}
          {moreView && (
            <motion.div
              className="w-full lg:w-[46%] flex-1 min-w-0"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.25 }}
            >
              <div className="flex w-full flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xl font-bold tracking-tight text-[#20232B]">
                      Schedule
                    </h3>
                    <p className="text-xs text-[#737987]">
                      Hover or click any highlighted date to bring its tasks to
                      the top.
                    </p>
                  </div>
                  {selectedDay && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-[#635BDB]"
                      onClick={() => setSelectedDay(null)}
                    >
                      Clear filter
                    </Button>
                  )}
                </div>

                <motion.div
                  className="flex h-[510px] flex-col items-stretch justify-start overflow-y-auto rounded-xl border border-[#EAECF0] bg-[#FAFBFC]"
                  layout
                >
                  {sortedTaskDays.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
                      <CalendarIcon className="h-8 w-8 text-[#CBD5E1] mb-2" />
                      <p className="text-sm font-medium text-[#20232B]">
                        No deadlines in {format(cursorDate, "MMMM yyyy")}
                      </p>
                      <p className="mt-1 text-xs text-[#737987]">
                        Tasks with due dates in this month will appear here.
                      </p>
                    </div>
                  ) : (
                    <AnimatePresence>
                      {sortedTaskDays.map((day) => {
                        const isHighlighted = activeFocusDay === day.key;
                        return (
                          <motion.div
                            key={day.key}
                            layout
                            className={cn(
                              "w-full border-b border-[#EAECF0] last:border-b-0 transition-colors",
                              isHighlighted
                                ? "bg-[#F5F4FF] border-l-2 border-l-[#635BDB]"
                                : "bg-white"
                            )}
                          >
                            {day.tasks.map((task, idx) => {
                              const overdue = isTaskOverdue(
                                task.dueDate,
                                task.status
                              );
                              const participantNames = [
                                task.assignee?.name,
                                ...task.collaborators.map((c) => c.user.name),
                              ].filter(Boolean) as string[];

                              return (
                                <motion.button
                                  type="button"
                                  key={task.id}
                                  onClick={() => onSelectTask(task.id)}
                                  className="w-full text-left border-b border-[#F1F3F7] p-3.5 last:border-b-0 hover:bg-[#F7F8FA] transition-colors block"
                                  initial={{ opacity: 0, y: 8 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -8 }}
                                  transition={{
                                    duration: 0.18,
                                    delay: idx * 0.03,
                                  }}
                                >
                                  <div className="mb-1.5 flex items-center justify-between gap-2">
                                    <span
                                      className={cn(
                                        "text-xs font-semibold",
                                        overdue
                                          ? "text-[#EF4444]"
                                          : isHighlighted
                                          ? "text-[#5148C9]"
                                          : "text-[#525866]"
                                      )}
                                    >
                                      {format(day.date, "EEE, d MMM")}
                                      {overdue ? " · Overdue" : ""}
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                      <TaskStatusBadge status={task.status} />
                                      <PriorityBadge
                                        priority={task.priority}
                                        showLabel={false}
                                      />
                                    </div>
                                  </div>

                                  <div className="flex items-baseline gap-2 min-w-0">
                                    <span className="font-mono text-[11px] font-medium text-[#9CA3AF] shrink-0">
                                      {task.taskKey}
                                    </span>
                                    <h4 className="text-sm font-semibold text-[#20232B] truncate">
                                      {task.title}
                                    </h4>
                                  </div>

                                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[#737987]">
                                    <span className="inline-flex items-center gap-1.5 truncate max-w-[60%]">
                                      <Users className="h-3.5 w-3.5 shrink-0 text-[#9CA3AF]" />
                                      <span className="truncate">
                                        {participantNames.length > 0
                                          ? participantNames.join(", ")
                                          : "Unassigned"}
                                      </span>
                                    </span>
                                    <span className="inline-flex items-center gap-1.5 font-medium text-[#525866] shrink-0">
                                      <FolderKanban
                                        className="h-3.5 w-3.5"
                                        style={{ color: task.project.color }}
                                      />
                                      <span className="truncate max-w-[130px]">
                                        {task.project.name}
                                      </span>
                                    </span>
                                  </div>
                                </motion.button>
                              );
                            })}
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  )}
                </motion.div>
              </div>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
