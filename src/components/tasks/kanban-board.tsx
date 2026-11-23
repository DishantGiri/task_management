"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlertTriangle,
  Calendar,
  GitBranch,
  GripVertical,
  MessageSquare,
  Paperclip,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import type { Role, TaskStatus } from "@prisma/client";
import type { TaskListItem } from "@/types";
import { moveTaskKanbanAction } from "@/actions/tasks";
import {
  cn,
  formatCompactDate,
  getDisplayTaskProgress,
  isTaskOverdue,
  STATUS_CONFIG,
  validateTaskStatusTransition,
} from "@/lib/utils";
import { PriorityBadge } from "@/components/shared/badges";
import { UserAvatar } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const COLUMNS: { id: TaskStatus; label: string; dot: string }[] = [
  { id: "TODO", label: "To Do", dot: "bg-slate-400" },
  { id: "IN_PROGRESS", label: "In Progress", dot: "bg-blue-500" },
  { id: "IN_REVIEW", label: "In Review / QA", dot: "bg-amber-500" },
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
    data: { type: "task", task, status: task.status },
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
      onClick={() => {
        if (!isDragging) onSelect(task.id);
      }}
      className={cn(
        "group relative rounded-lg border border-[#EAECF0] bg-white p-3.5 shadow-subtle transition-all hover:border-[#C7CBE0] hover:shadow-card select-none touch-none",
        isOverlay
          ? "cursor-grabbing shadow-xl border-[#635BDB] ring-2 ring-[#635BDB]/20 rotate-[1.5deg] scale-[1.02]"
          : "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-30 border-dashed border-[#635BDB]"
      )}
    >
      {/* Top Meta Row with Grab Handle */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="inline-flex h-5 w-5 -ml-1 items-center justify-center rounded text-[#9CA3AF] group-hover:bg-[#F3F4F6] group-hover:text-[#525866] transition-colors"
            title="Grab and drag to move"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </span>
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

      {/* Active Blocker Indicator (Modern Agile visibility) */}
      {task.status !== "DONE" &&
        task.dependencies.some((d) => d.dependsOn.status !== "DONE") && (() => {
          const openBlockers = task.dependencies.filter(
            (d) => d.dependsOn.status !== "DONE"
          );
          const tooltip = openBlockers
            .map((d) => `${d.dependsOn.taskKey}: ${d.dependsOn.title}`)
            .join("\n");
          return (
            <div className="mt-2" title={`Blocked by:\n${tooltip}`}>
              <span className="inline-flex items-center gap-1 rounded-[4px] border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                <AlertTriangle className="h-3 w-3 shrink-0 text-amber-600" />
                {openBlockers.length === 1
                  ? `Blocked by ${openBlockers[0].dependsOn.taskKey}`
                  : `Blocked (${openBlockers.length})`}
              </span>
            </div>
          );
        })()}

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
            <span className="font-medium text-[#20232B]">
              {getDisplayTaskProgress(task)}%
            </span>
          </div>
          <Progress
            value={getDisplayTaskProgress(task)}
            className="h-1"
          />
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
        "flex flex-col rounded-lg border border-[#EAECF0] bg-[#F3F5F8]/70 min-h-[480px] transition-colors",
        isOver && "border-[#635BDB] bg-[#F0EFFF]/50 ring-2 ring-[#635BDB]/15"
      )}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[#EAECF0]/80">
        <div className="flex items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full", column.dot)} />
          <h3 className="text-[13px] font-semibold text-[#20232B]">
            {column.label}
          </h3>
          <span className="rounded-full bg-white border border-[#EAECF0] px-1.5 text-[11px] font-medium text-[#737987]">
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
            <div
              className={cn(
                "flex h-28 items-center justify-center rounded-md border border-dashed text-[11.5px] transition-colors",
                isOver
                  ? "border-[#635BDB] bg-[#F0EFFF]/60 text-[#5148C9] font-medium"
                  : "border-[#D9DEE7] text-[#9CA3AF]"
              )}
            >
              {isOver ? `Drop into ${column.label}` : "Grab and drag tasks here"}
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
  currentUserRole = "EMPLOYEE",
}: {
  tasks: TaskListItem[];
  onTasksChange: (next: TaskListItem[]) => void;
  onSelectTask: (id: string) => void;
  onQuickAdd: (status: TaskStatus) => void;
  canCreate: boolean;
  currentUserRole?: Role;
}) {
  const router = useRouter();
  const [activeTask, setActiveTask] = useState<TaskListItem | null>(null);
  const [pendingBlockedMove, setPendingBlockedMove] = useState<{
    task: TaskListItem;
    targetStatus: TaskStatus;
    newPosition: number;
    openBlockers: { taskKey: string; title: string }[];
    optimisticTasks: TaskListItem[];
    previousTasks: TaskListItem[];
  } | null>(null);
  const [confirmingMove, setConfirmingMove] = useState(false);
  const initialStatusRef = useRef<TaskStatus | null>(null);
  const snapshotRef = useRef<TaskListItem[]>(tasks);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const resolveStatus = (overId: string): TaskStatus | null => {
    if (COLUMNS.some((c) => c.id === overId)) {
      return overId as TaskStatus;
    }
    const overTask = tasks.find((t) => t.id === overId);
    return overTask ? overTask.status : null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const found = tasks.find((t) => t.id === event.active.id);
    if (found) {
      setActiveTask(found);
      initialStatusRef.current = found.status;
      snapshotRef.current = tasks;
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const currentTask = tasks.find((t) => t.id === activeId);
    if (!currentTask) return;

    const targetStatus = resolveStatus(overId);
    if (!targetStatus) return;

    if (currentTask.status !== targetStatus) {
      const updated = tasks.map((t) =>
        t.id === activeId
          ? {
              ...t,
              status: targetStatus,
              progress: getDisplayTaskProgress({ ...t, status: targetStatus }),
            }
          : t
      );
      onTasksChange(updated);
    } else {
      const oldIndex = tasks.findIndex((t) => t.id === activeId);
      const newIndex = tasks.findIndex((t) => t.id === overId);
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        onTasksChange(arrayMove(tasks, oldIndex, newIndex));
      }
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    const draggedId = String(active.id);
    const currentTask = tasks.find((t) => t.id === draggedId);
    const startStatus = initialStatusRef.current;

    setActiveTask(null);
    initialStatusRef.current = null;

    if (!over || !currentTask) {
      onTasksChange(snapshotRef.current);
      return;
    }

    const overId = String(over.id);
    const targetStatus = resolveStatus(overId) || currentTask.status;

    const columnTasks = tasks.filter((t) => t.status === targetStatus);
    const newPosition = Math.max(
      0,
      columnTasks.findIndex((t) => t.id === draggedId)
    );

    if (startStatus === targetStatus && draggedId === overId) {
      return;
    }

    const openBlockers = currentTask.dependencies
      .filter((d) => d.dependsOn.status !== "DONE")
      .map((d) => ({
        taskKey: d.dependsOn.taskKey,
        title: d.dependsOn.title,
      }));
    const openBlockerKeys = openBlockers.map((b) => b.taskKey);
    const isAdminOrManager =
      currentUserRole === "ADMIN" || currentUserRole === "MANAGER";

    if (startStatus && startStatus !== targetStatus) {
      const incompleteSubtasks = currentTask.subtasks.filter(
        (s) => s.status !== "DONE"
      ).length;

      // Validate all non-blocker rules first (unassigned, start before done, subtasks, etc.)
      const baseError = validateTaskStatusTransition({
        currentStatus: startStatus,
        nextStatus: targetStatus,
        isSubtask: Boolean(currentTask.parentId),
        totalSubtasks: currentTask.subtasks.length,
        incompleteSubtasks,
        canMarkComplete: true,
        hasAssignee: Boolean(currentTask.assignee),
        incompleteBlockers: isAdminOrManager ? [] : openBlockerKeys,
      });
      if (baseError) {
        onTasksChange(snapshotRef.current);
        toast.error(baseError);
        return;
      }

      // Ask for explicit confirmation warning whenever moving a blocked ticket to a new status
      if (openBlockers.length > 0 && targetStatus !== "TODO") {
        const optimisticSnapshot = tasks;
        onTasksChange(snapshotRef.current);
        setPendingBlockedMove({
          task: currentTask,
          targetStatus,
          newPosition,
          openBlockers,
          optimisticTasks: optimisticSnapshot,
          previousTasks: snapshotRef.current,
        });
        return;
      }
    }

    const res = await moveTaskKanbanAction(
      draggedId,
      targetStatus,
      newPosition
    );
    if (res.error) {
      onTasksChange(snapshotRef.current);
      toast.error(res.error);
      return;
    }

    if (startStatus !== targetStatus) {
      toast.success(
        `${currentTask.taskKey} moved to ${STATUS_CONFIG[targetStatus].label}`
      );
    }
    router.refresh();
  };

  const handleConfirmBlockedMove = async () => {
    if (!pendingBlockedMove) return;
    const { task, targetStatus, newPosition, optimisticTasks, previousTasks } =
      pendingBlockedMove;
    setConfirmingMove(true);
    onTasksChange(optimisticTasks);

    const isAdminOrManager =
      currentUserRole === "ADMIN" || currentUserRole === "MANAGER";
    const res = await moveTaskKanbanAction(
      task.id,
      targetStatus,
      newPosition,
      isAdminOrManager
    );
    setConfirmingMove(false);
    setPendingBlockedMove(null);

    if (res.error) {
      onTasksChange(previousTasks);
      toast.error(res.error);
      return;
    }

    toast.warning(
      `${task.taskKey} moved to ${STATUS_CONFIG[targetStatus].label} with active blockers.`
    );
    router.refresh();
  };

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
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
            <KanbanTaskCard task={activeTask} onSelect={() => {}} isOverlay />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Blocked Ticket Warning Confirmation Dialog */}
      <Dialog
        open={!!pendingBlockedMove}
        onOpenChange={(open) => {
          if (!open) setPendingBlockedMove(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-800">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
              Task Has Unfinished Blockers
            </DialogTitle>
            <DialogDescription>
              <strong className="text-[#20232B]">
                {pendingBlockedMove?.task.taskKey}
              </strong>{" "}
              is currently blocked by unfinished prerequisite task(s). Are you
              sure you want to move it to{" "}
              <strong className="text-[#20232B]">
                {pendingBlockedMove
                  ? STATUS_CONFIG[pendingBlockedMove.targetStatus].label
                  : ""}
              </strong>
              ?
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md border border-amber-200 bg-amber-50/80 p-3 space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-800">
              Blocking Tasks
            </p>
            {pendingBlockedMove?.openBlockers.map((b) => (
              <div
                key={b.taskKey}
                className="flex items-center gap-2 text-xs text-amber-950"
              >
                <span className="font-mono font-semibold shrink-0">
                  {b.taskKey}
                </span>
                <span className="truncate">{b.title}</span>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={confirmingMove}
              onClick={() => setPendingBlockedMove(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={confirmingMove}
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={handleConfirmBlockedMove}
            >
              Move Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
