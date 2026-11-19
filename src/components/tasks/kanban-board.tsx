"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Calendar,
  GitBranch,
  MessageSquare,
  Paperclip,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import type { TaskStatus } from "@prisma/client";
import type { TaskListItem } from "@/types";
import { moveTaskKanbanAction } from "@/actions/tasks";
import { cn, formatCompactDate, isTaskOverdue, STATUS_CONFIG } from "@/lib/utils";
import { PriorityBadge } from "@/components/shared/badges";
import { UserAvatar } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";

const COLUMNS: { id: TaskStatus; label: string; dot: string }[] = [
  { id: "TODO", label: "To Do", dot: "bg-slate-400" },
  { id: "IN_PROGRESS", label: "In Progress", dot: "bg-blue-500" },
  { id: "IN_REVIEW", label: "In Review", dot: "bg-amber-500" },
  { id: "DONE", label: "Done", dot: "bg-emerald-500" },
];

function KanbanTaskCard({
  task,
  onSelect,
  isOverlay = false,
}: {
  task: TaskListItem;
  onSelect: (id: string) => void;
  isOverlay?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { type: "task", task },
  });

  const style = isOverlay
    ? undefined
    : {
        transform: CSS.Transform.toString(transform),
        transition,
      };

  const overdue = isTaskOverdue(task.dueDate, task.status);
  const doneSubtasks = task.subtasks.filter((s) => s.status === "DONE").length;
  const totalSubtasks = task.subtasks.length;

  return (
    <div
      ref={isOverlay ? undefined : setNodeRef}
      style={style}
      {...(isOverlay ? {} : attributes)}
      {...(isOverlay ? {} : listeners)}
      onClick={() => onSelect(task.id)}
      className={cn(
        "group cursor-pointer rounded-lg border border-[#EAECF0] bg-white p-3.5 shadow-subtle transition-all hover:border-[#C7CBE0] hover:shadow-card select-none",
        isDragging && "opacity-35",
        isOverlay && "shadow-lg border-[#635BDB] rotate-[1deg]"
      )}
    >
      {/* Top Meta Row */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="h-2 w-2 shrink-0 rounded-[2px]"
            style={{ backgroundColor: task.project.color }}
          />
          <span className="font-mono text-[11px] font-medium text-[#737987]">
            {task.taskKey}
          </span>
        </div>
        <PriorityBadge priority={task.priority} showLabel={false} />
      </div>

      {/* Title */}
      <p className="text-[13px] font-medium leading-snug text-[#20232B] line-clamp-2 group-hover:text-[#5148C9] transition-colors">
        {task.title}
      </p>

      {/* Tags */}
      {task.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {task.tags.slice(0, 3).map(({ tag }) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 rounded-[4px] border border-[#EAECF0] bg-[#F7F8FA] px-1.5 py-0.5 text-[10px] font-medium text-[#525866]"
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: tag.color }}
              />
              {tag.name}
            </span>
          ))}
        </div>
      )}

      {/* Subtask Progress */}
      {totalSubtasks > 0 && (
        <div className="mt-2.5 space-y-1">
          <div className="flex items-center justify-between text-[11px] text-[#737987]">
            <span className="inline-flex items-center gap-1">
              <GitBranch className="h-3 w-3" />
              {doneSubtasks}/{totalSubtasks} subtasks
            </span>
            <span className="font-medium text-[#20232B]">{task.progress}%</span>
          </div>
          <Progress value={task.progress} className="h-1" />
        </div>
      )}

      {/* Footer */}
      <div className="mt-3 pt-2.5 border-t border-[#F1F3F7] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 text-[11px] text-[#737987]">
          {task.dueDate && (
            <span
              className={cn(
                "inline-flex items-center gap-1 font-medium",
                overdue ? "text-[#EF4444]" : "text-[#737987]"
              )}
            >
              <Calendar className="h-3 w-3" />
              {formatCompactDate(task.dueDate)}
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

        {/* Assignee & Collaborators Stack */}
        <div className="flex items-center -space-x-1.5">
          {task.assignee && (
            <UserAvatar
              name={task.assignee.name}
              avatarUrl={task.assignee.avatarUrl}
              size="xs"
              className="ring-2 ring-white"
            />
          )}
          {task.collaborators.slice(0, 2).map(({ user }) => (
            <UserAvatar
              key={user.id}
              name={user.name}
              avatarUrl={user.avatarUrl}
              size="xs"
              className="ring-2 ring-white"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function KanbanColumn({
  column,
  tasks,
  onSelectTask,
  onQuickAdd,
  canCreate,
}: {
  column: { id: TaskStatus; label: string; dot: string };
  tasks: TaskListItem[];
  onSelectTask: (id: string) => void;
  onQuickAdd: (status: TaskStatus) => void;
  canCreate: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: "column", status: column.id },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col rounded-lg border border-[#EAECF0] bg-[#F3F5F8]/70 min-h-[460px] transition-colors",
        isOver && "border-[#635BDB] bg-[#F0EFFF]/40"
      )}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[#EAECF0]/80">
        <div className="flex items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full", column.dot)} />
          <h3 className="text-[13px] font-semibold text-[#20232B]">
            {column.label}
          </h3>
          <span className="rounded-full bg-white border border-[#EAECF0] px-1.5 py-0.2 text-[11px] font-medium text-[#737987]">
            {tasks.length}
          </span>
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={() => onQuickAdd(column.id)}
            className="rounded-md p-1 text-[#737987] hover:bg-white hover:text-[#20232B] transition-colors"
            title={`Add task to ${column.label}`}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Cards Container */}
      <SortableContext
        items={tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex-1 p-2.5 space-y-2.5">
          {tasks.length === 0 ? (
            <div className="flex h-24 items-center justify-center rounded-md border border-dashed border-[#D9DEE7] text-[11.5px] text-[#9CA3AF]">
              Drop tasks here
            </div>
          ) : (
            tasks.map((task) => (
              <KanbanTaskCard
                key={task.id}
                task={task}
                onSelect={onSelectTask}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export function KanbanBoard({
  tasks,
  onTasksChange,
  onSelectTask,
  onQuickAdd,
  canCreate,
}: {
  tasks: TaskListItem[];
  onTasksChange: (next: TaskListItem[]) => void;
  onSelectTask: (id: string) => void;
  onQuickAdd: (status: TaskStatus) => void;
  canCreate: boolean;
}) {
  const router = useRouter();
  const [activeTask, setActiveTask] = useState<TaskListItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const found = tasks.find((t) => t.id === event.active.id);
    if (found) setActiveTask(found);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);
    if (!over) return;

    const draggedId = String(active.id);
    const draggedTask = tasks.find((t) => t.id === draggedId);
    if (!draggedTask) return;

    let targetStatus: TaskStatus = draggedTask.status;
    const overId = String(over.id);

    if (COLUMNS.some((c) => c.id === overId)) {
      targetStatus = overId as TaskStatus;
    } else {
      const overTask = tasks.find((t) => t.id === overId);
      if (overTask) targetStatus = overTask.status;
    }

    if (targetStatus === draggedTask.status && draggedId === overId) {
      return;
    }

    const previous = tasks;
    const targetColumnCount = tasks.filter(
      (t) => t.status === targetStatus && t.id !== draggedId
    ).length;

    const optimistic = tasks.map((t) =>
      t.id === draggedId
        ? {
            ...t,
            status: targetStatus,
            progress:
              t.subtasks.length === 0
                ? targetStatus === "DONE"
                  ? 100
                  : targetStatus === "IN_REVIEW"
                  ? 75
                  : targetStatus === "IN_PROGRESS"
                  ? 40
                  : 0
                : t.progress,
          }
        : t
    );

    onTasksChange(optimistic);

    const res = await moveTaskKanbanAction(
      draggedId,
      targetStatus,
      targetColumnCount
    );
    if (res.error) {
      onTasksChange(previous);
      toast.error(res.error);
      return;
    }

    toast.success(
      `${draggedTask.taskKey} moved to ${STATUS_CONFIG[targetStatus].label}`
    );
    router.refresh();
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.id}
            column={col}
            tasks={tasks.filter((t) => t.status === col.id)}
            onSelectTask={onSelectTask}
            onQuickAdd={onQuickAdd}
            canCreate={canCreate}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask ? (
          <KanbanTaskCard
            task={activeTask}
            onSelect={() => {}}
            isOverlay
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
