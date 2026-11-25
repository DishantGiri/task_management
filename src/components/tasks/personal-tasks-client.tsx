"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
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
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Bookmark,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  GripVertical,
  Kanban,
  List,
  ListChecks,
  Loader2,
  Lock,
  Pencil,
  Pin,
  Plus,
  Search,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { Priority, TaskStatus } from "@prisma/client";
import type { PersonalTaskItem } from "@/types";
import {
  addPersonalChecklistItemAction,
  clearCompletedPersonalTasksAction,
  createPersonalTaskAction,
  deletePersonalTaskAction,
  removePersonalChecklistItemAction,
  togglePersonalChecklistItemAction,
  updatePersonalTaskAction,
} from "@/actions/personal-tasks";
import {
  cn,
  formatCompactDate,
  getServerTodayStr,
  isTaskOverdue,
  STATUS_CONFIG,
} from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { PriorityBadge } from "@/components/shared/badges";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

const CATEGORIES = [
  "Focus",
  "General",
  "Follow-up",
  "Learning",
  "Admin",
  "Goals",
] as const;

const CATEGORY_STYLES: Record<string, string> = {
  Focus: "bg-[#F0EFFF] text-[#5148C9] border-[#D9D6FE]",
  General: "bg-slate-100 text-slate-700 border-slate-200",
  "Follow-up": "bg-amber-50 text-amber-700 border-amber-200",
  Learning: "bg-sky-50 text-sky-700 border-sky-200",
  Admin: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Goals: "bg-pink-50 text-pink-700 border-pink-200",
};

const COLUMNS: { id: TaskStatus; label: string; dot: string }[] = [
  { id: "TODO", label: "To Do", dot: "bg-slate-400" },
  { id: "IN_PROGRESS", label: "In Progress", dot: "bg-blue-500" },
  { id: "IN_REVIEW", label: "In Review", dot: "bg-amber-500" },
  { id: "DONE", label: "Done", dot: "bg-emerald-500" },
];

function PersonalKanbanCard({
  task,
  onSelect,
  onStatusChange,
  isOverlay = false,
}: {
  task: PersonalTaskItem;
  onSelect: (task: PersonalTaskItem) => void;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
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
    data: { type: "personal-task", task, status: task.status },
  });

  const style = isOverlay
    ? undefined
    : {
        transform: CSS.Transform.toString(transform),
        transition,
      };

  const overdue = isTaskOverdue(task.dueDate, task.status);
  const doneChecks = task.checklist.filter((c) => c.completed).length;

  return (
    <div
      ref={isOverlay ? undefined : setNodeRef}
      style={style}
      {...(isOverlay ? {} : attributes)}
      {...(isOverlay ? {} : listeners)}
      onClick={() => {
        if (!isDragging) onSelect(task);
      }}
      className={cn(
        "group relative rounded-lg border border-[#EAECF0] bg-white p-3.5 shadow-subtle hover:border-[#C7CBE0] hover:shadow-card transition-all select-none touch-none",
        isOverlay
          ? "cursor-grabbing shadow-xl border-[#635BDB] ring-2 ring-[#635BDB]/20 rotate-[1.5deg] scale-[1.02]"
          : "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-30 border-dashed border-[#635BDB]"
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5">
          <span
            className="inline-flex h-5 w-5 -ml-1 items-center justify-center rounded text-[#9CA3AF] group-hover:bg-[#F3F4F6] group-hover:text-[#525866] transition-colors"
            title="Grab and drag to move"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </span>
          <span
            className={cn(
              "rounded-[4px] border px-1.5 py-0.5 text-[10px] font-medium",
              CATEGORY_STYLES[task.category] || CATEGORY_STYLES.General
            )}
          >
            {task.category}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {task.isPinned && <Pin className="h-3 w-3 text-[#635BDB]" />}
          <PriorityBadge priority={task.priority} showLabel={false} />
        </div>
      </div>

      <p className="text-[13px] font-medium text-[#20232B] leading-snug">
        {task.title}
      </p>

      {task.notes && (
        <p className="mt-1 text-xs text-[#737987] line-clamp-2">{task.notes}</p>
      )}

      {task.checklist.length > 0 && (
        <div className="mt-2.5 flex items-center justify-between text-[11px] text-[#737987]">
          <span className="inline-flex items-center gap-1">
            <ListChecks className="h-3 w-3" />
            {doneChecks}/{task.checklist.length} steps
          </span>
        </div>
      )}

      <div
        className="mt-3 pt-2 border-t border-[#F1F3F7] flex items-center justify-between gap-2"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <span
          className={cn(
            "text-[11px]",
            overdue ? "font-semibold text-[#EF4444]" : "text-[#737987]"
          )}
        >
          {formatCompactDate(task.dueDate)}
        </span>
        <Select
          value={task.status}
          onValueChange={(v) => onStatusChange(task.id, v as TaskStatus)}
        >
          <SelectTrigger className="h-6 w-[108px] text-[11px] px-2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODO">To Do</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="IN_REVIEW">In Review</SelectItem>
            <SelectItem value="DONE">Done</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function PersonalKanbanColumn({
  column,
  tasks,
  onSelect,
  onStatusChange,
}: {
  column: { id: TaskStatus; label: string; dot: string };
  tasks: PersonalTaskItem[];
  onSelect: (task: PersonalTaskItem) => void;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: "personal-column", status: column.id },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col rounded-lg border border-[#EAECF0] bg-[#F3F5F8]/70 min-h-[440px] transition-colors",
        isOver && "border-[#635BDB] bg-[#F0EFFF]/50 ring-2 ring-[#635BDB]/15"
      )}
    >
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
      </div>

      <SortableContext
        items={tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="p-2.5 space-y-2.5 flex-1">
          {tasks.length === 0 ? (
            <div
              className={cn(
                "flex h-28 items-center justify-center rounded-md border border-dashed text-xs transition-colors",
                isOver
                  ? "border-[#635BDB] bg-[#F0EFFF]/60 text-[#5148C9] font-medium"
                  : "border-[#D9DEE7] text-[#9CA3AF]"
              )}
            >
              {isOver ? `Drop into ${column.label}` : "Grab and drag tasks here"}
            </div>
          ) : (
            tasks.map((task) => (
              <PersonalKanbanCard
                key={task.id}
                task={task}
                onSelect={onSelect}
                onStatusChange={onStatusChange}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export function PersonalTasksClient({
  initialTasks,
}: {
  initialTasks: PersonalTaskItem[];
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState<PersonalTaskItem[]>(initialTasks);
  const [view, setView] = useState<"list" | "board">("list");
  const [activeDragTask, setActiveDragTask] = useState<PersonalTaskItem | null>(
    null
  );
  const dragInitialStatusRef = useRef<TaskStatus | null>(null);
  const dragSnapshotRef = useRef<PersonalTaskItem[]>(initialTasks);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    })
  );

  // Quick capture state
  const [quickTitle, setQuickTitle] = useState("");
  const [quickCategory, setQuickCategory] = useState<string>("Focus");
  const [quickPriority, setQuickPriority] = useState<Priority>("MEDIUM");
  const [quickDueDate, setQuickDueDate] = useState("");
  const [quickPinned, setQuickPinned] = useState(false);
  const [creating, setCreating] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Expanded checklist rows
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const withChecklist = initialTasks
      .filter((t) => t.checklist.length > 0)
      .slice(0, 2)
      .map((t) => t.id);
    return new Set(withChecklist);
  });
  const [newCheckText, setNewCheckText] = useState<Record<string, string>>({});

  // Detail Drawer state
  const [selectedTask, setSelectedTask] = useState<PersonalTaskItem | null>(
    null
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [savingDetail, setSavingDetail] = useState(false);
  const [drawerCheckInput, setDrawerCheckInput] = useState("");

  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  useEffect(() => {
    if (selectedTask) {
      const latest = tasks.find((t) => t.id === selectedTask.id);
      if (latest) {
        setSelectedTask(latest);
      }
    }
  }, [tasks, selectedTask]);

  const openTaskDrawer = (task: PersonalTaskItem) => {
    setSelectedTask(task);
    setEditTitle(task.title);
    setEditNotes(task.notes || "");
    setDrawerOpen(true);
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Instant Optimistic Quick Add Handler
  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const titleToCreate = quickTitle.trim();
    if (!titleToCreate) return;

    const tempId = `temp-${Date.now()}`;
    const optimisticTask: PersonalTaskItem = {
      id: tempId,
      title: titleToCreate,
      notes: null,
      status: "TODO",
      priority: quickPriority,
      category: quickCategory,
      dueDate: quickDueDate ? new Date(quickDueDate).toISOString() : null,
      isPinned: quickPinned,
      checklist: [],
      completedAt: null,
      userId: "me",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const savedCategory = quickCategory;
    const savedPriority = quickPriority;
    const savedDueDate = quickDueDate || null;
    const savedPinned = quickPinned;

    // Immediately update UI & clear form in 0ms
    setTasks((prev) => [optimisticTask, ...prev]);
    setQuickTitle("");
    setQuickDueDate("");
    setQuickPinned(false);
    toast.success("Personal task added");

    const res = await createPersonalTaskAction({
      title: titleToCreate,
      category: savedCategory,
      priority: savedPriority,
      dueDate: savedDueDate,
      isPinned: savedPinned,
      status: "TODO",
      checklist: [],
    });

    if (res.error) {
      setTasks((prev) => prev.filter((t) => t.id !== tempId));
      toast.error(res.error);
      return;
    }

    if (res.task) {
      setTasks((prev) =>
        prev.map((t) => (t.id === tempId ? res.task! : t))
      );
    }
    router.refresh();
  };

  const handleUpdateTask = async (
    taskId: string,
    patch: Partial<PersonalTaskItem>
  ) => {
    const prev = tasks;
    setTasks((curr) =>
      curr.map((t) => (t.id === taskId ? { ...t, ...patch } : t))
    );

    const res = await updatePersonalTaskAction({ id: taskId, ...patch });
    if (res.error) {
      setTasks(prev);
      toast.error(res.error);
      return;
    }
    router.refresh();
  };

  const handleDeleteTask = async (taskId: string) => {
    const prev = tasks;
    setTasks((curr) => curr.filter((t) => t.id !== taskId));
    if (selectedTask?.id === taskId) {
      setDrawerOpen(false);
      setSelectedTask(null);
    }

    const res = await deletePersonalTaskAction(taskId);
    if (res.error) {
      setTasks(prev);
      toast.error(res.error);
      return;
    }
    toast.success("Personal task deleted");
    router.refresh();
  };

  const handleClearCompleted = async () => {
    const prev = tasks;
    setTasks((curr) => curr.filter((t) => t.status !== "DONE"));
    const res = await clearCompletedPersonalTasksAction();
    if (res.error) {
      setTasks(prev);
      toast.error(res.error);
      return;
    }
    toast.success("Cleared completed personal tasks");
    router.refresh();
  };

  const handleAddChecklistItem = async (taskId: string, text: string) => {
    if (!text.trim()) return;
    const res = await addPersonalChecklistItemAction(taskId, text.trim());
    if (res.error) {
      toast.error(res.error);
      return;
    }
    if (res.checklist) {
      setTasks((curr) =>
        curr.map((t) =>
          t.id === taskId ? { ...t, checklist: res.checklist! } : t
        )
      );
      setExpandedIds((prev) => new Set(prev).add(taskId));
    }
    setNewCheckText((prev) => ({ ...prev, [taskId]: "" }));
    router.refresh();
  };

  const handleToggleChecklistItem = async (taskId: string, itemId: string) => {
    const prev = tasks;
    setTasks((curr) =>
      curr.map((t) =>
        t.id === taskId
          ? {
              ...t,
              checklist: t.checklist.map((c) =>
                c.id === itemId ? { ...c, completed: !c.completed } : c
              ),
            }
          : t
      )
    );
    const res = await togglePersonalChecklistItemAction(taskId, itemId);
    if (res.error) {
      setTasks(prev);
      toast.error(res.error);
    }
  };

  const handleRemoveChecklistItem = async (taskId: string, itemId: string) => {
    const prev = tasks;
    setTasks((curr) =>
      curr.map((t) =>
        t.id === taskId
          ? {
              ...t,
              checklist: t.checklist.filter((c) => c.id !== itemId),
            }
          : t
      )
    );
    const res = await removePersonalChecklistItemAction(taskId, itemId);
    if (res.error) {
      setTasks(prev);
      toast.error(res.error);
    }
  };

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (categoryFilter === "PINNED" && !t.isPinned) return false;
      if (
        categoryFilter !== "ALL" &&
        categoryFilter !== "PINNED" &&
        t.category !== categoryFilter
      ) {
        return false;
      }
      if (statusFilter !== "ALL" && t.status !== statusFilter) return false;
      if (q) {
        const inTitle = t.title.toLowerCase().includes(q);
        const inNotes = (t.notes || "").toLowerCase().includes(q);
        const inChecklist = t.checklist.some((c) =>
          c.title.toLowerCase().includes(q)
        );
        if (!inTitle && !inNotes && !inChecklist) return false;
      }
      return true;
    });
  }, [tasks, search, categoryFilter, statusFilter]);

  // Metrics
  const totalCount = tasks.length;
  const completedCount = tasks.filter((t) => t.status === "DONE").length;
  const pinnedCount = tasks.filter(
    (t) => t.isPinned && t.status !== "DONE"
  ).length;
  const inProgressCount = tasks.filter(
    (t) => t.status === "IN_PROGRESS" || t.status === "IN_REVIEW"
  ).length;
  const completionPct =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[24px] font-semibold tracking-tight text-[#20232B]">
              My To-Dos
            </h1>
            <span className="inline-flex items-center gap-1 rounded-md border border-[#EAECF0] bg-white px-2 py-0.5 text-[11px] font-medium text-[#737987] shadow-subtle">
              <Lock className="h-3 w-3 text-[#635BDB]" />
              Private to you
            </span>
          </div>
          <p className="text-[13px] text-[#737987] mt-0.5">
            Your private checklist and daily focus board — separate from company project tasks.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {completedCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearCompleted}
              className="text-xs"
            >
              <Trash2 className="h-3.5 w-3.5 text-[#737987]" />
              Clear Completed ({completedCount})
            </Button>
          )}
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-lg border border-[#EAECF0] bg-white p-3.5 shadow-subtle">
          <div className="flex items-center justify-between text-xs text-[#737987]">
            <span>Pinned Focus</span>
            <Pin className="h-3.5 w-3.5 text-[#635BDB]" />
          </div>
          <p className="mt-1.5 text-xl font-semibold text-[#20232B]">
            {pinnedCount}
          </p>
        </div>
        <div className="rounded-lg border border-[#EAECF0] bg-white p-3.5 shadow-subtle">
          <div className="flex items-center justify-between text-xs text-[#737987]">
            <span>Active / In Progress</span>
            <ListChecks className="h-3.5 w-3.5 text-[#3B82F6]" />
          </div>
          <p className="mt-1.5 text-xl font-semibold text-[#20232B]">
            {inProgressCount}
          </p>
        </div>
        <div className="rounded-lg border border-[#EAECF0] bg-white p-3.5 shadow-subtle">
          <div className="flex items-center justify-between text-xs text-[#737987]">
            <span>Total Personal Tasks</span>
            <Bookmark className="h-3.5 w-3.5 text-[#F59E0B]" />
          </div>
          <p className="mt-1.5 text-xl font-semibold text-[#20232B]">
            {totalCount}
          </p>
        </div>
        <div className="rounded-lg border border-[#EAECF0] bg-white p-3.5 shadow-subtle">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-[#737987]">Completion</span>
            <span className="font-semibold text-[#16A34A]">
              {completedCount}/{totalCount} ({completionPct}%)
            </span>
          </div>
          <Progress value={completionPct} className="h-1.5 mt-2" />
        </div>
      </div>

      {/* Quick Capture Bar */}
      <form
        onSubmit={handleQuickAdd}
        className="rounded-lg border border-[#EAECF0] bg-white p-3.5 shadow-subtle space-y-3"
      >
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative flex-1">
            <Plus className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#635BDB]" />
            <input
              type="text"
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              placeholder="Add a personal task, reminder, or goal... (Press Enter to save)"
              className="h-9 w-full rounded-md border border-[#E2E6EE] bg-[#F7F8FA] pl-9 pr-3 text-[13px] text-[#20232B] placeholder:text-[#9CA3AF] focus:border-[#635BDB] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#635BDB]/15 transition-all"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={quickCategory} onValueChange={setQuickCategory}>
              <SelectTrigger className="h-9 w-[124px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={quickPriority}
              onValueChange={(v) => setQuickPriority(v as Priority)}
            >
              <SelectTrigger className="h-9 w-[112px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LOW">Low</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="URGENT">Urgent</SelectItem>
              </SelectContent>
            </Select>

            <DatePicker
              minDate={getServerTodayStr()}
              value={quickDueDate}
              placeholder="Due date"
              onChange={setQuickDueDate}
              className="h-9 w-[150px] text-xs"
            />

            <button
              type="button"
              onClick={() => setQuickPinned((v) => !v)}
              className={cn(
                "inline-flex h-9 items-center gap-1 rounded-md border px-2.5 text-xs font-medium transition-colors",
                quickPinned
                  ? "border-[#635BDB] bg-[#F0EFFF] text-[#5148C9]"
                  : "border-[#E2E6EE] bg-white text-[#737987] hover:bg-[#F7F8FA]"
              )}
              title="Pin to top"
            >
              <Pin className="h-3.5 w-3.5" />
              Pin
            </button>

            <Button
              type="submit"
              size="sm"
              className="h-9 px-4"
              disabled={creating || !quickTitle.trim()}
            >
              {creating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              Add Task
            </Button>
          </div>
        </div>
      </form>

      {/* Toolbar: View Switcher + Category Pills + Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: "ALL", label: "All" },
            { id: "PINNED", label: "Pinned" },
            ...CATEGORIES.map((c) => ({ id: c, label: c })),
          ].map((pill) => (
            <button
              key={pill.id}
              type="button"
              onClick={() => setCategoryFilter(pill.id)}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                categoryFilter === pill.id
                  ? "border-[#635BDB] bg-[#F0EFFF] text-[#5148C9]"
                  : "border-[#EAECF0] bg-white text-[#525866] hover:bg-[#F7F8FA]"
              )}
            >
              {pill.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-48 sm:w-56">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9CA3AF]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search personal tasks..."
              className="h-8 w-full rounded-md border border-[#E2E6EE] bg-white pl-8 pr-3 text-xs focus:border-[#635BDB] focus:outline-none"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-[124px] text-xs">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="TODO">To Do</SelectItem>
              <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
              <SelectItem value="IN_REVIEW">In Review</SelectItem>
              <SelectItem value="DONE">Done</SelectItem>
            </SelectContent>
          </Select>

          <div className="inline-flex rounded-md border border-[#EAECF0] bg-white p-0.5">
            <button
              type="button"
              onClick={() => setView("list")}
              className={cn(
                "inline-flex items-center gap-1 rounded-[4px] px-2.5 py-1 text-xs font-medium",
                view === "list"
                  ? "bg-[#F0EFFF] text-[#5148C9]"
                  : "text-[#737987] hover:text-[#20232B]"
              )}
            >
              <List className="h-3.5 w-3.5" />
              List
            </button>
            <button
              type="button"
              onClick={() => setView("board")}
              className={cn(
                "inline-flex items-center gap-1 rounded-[4px] px-2.5 py-1 text-xs font-medium",
                view === "board"
                  ? "bg-[#F0EFFF] text-[#5148C9]"
                  : "text-[#737987] hover:text-[#20232B]"
              )}
            >
              <Kanban className="h-3.5 w-3.5" />
              Board
            </button>
          </div>
        </div>
      </div>

      {/* Main Content: List View or Board View */}
      {filteredTasks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#D9DEE7] bg-white py-14 text-center">
          <ListChecks className="mx-auto h-6 w-6 text-[#9CA3AF] mb-2" />
          <p className="text-sm font-medium text-[#20232B]">
            No personal tasks match your view
          </p>
          <p className="mt-1 text-xs text-[#737987]">
            Use the quick capture bar above to add a personal to-do or focus goal.
          </p>
        </div>
      ) : view === "list" ? (
        <div className="divide-y divide-[#EAECF0] rounded-lg border border-[#EAECF0] bg-white shadow-subtle overflow-hidden">
          {filteredTasks.map((task) => {
            const isDone = task.status === "DONE";
            const overdue = isTaskOverdue(task.dueDate, task.status);
            const isExpanded = expandedIds.has(task.id);
            const doneCheckCount = task.checklist.filter(
              (c) => c.completed
            ).length;
            const totalCheckCount = task.checklist.length;
            const checkPct =
              totalCheckCount > 0
                ? Math.round((doneCheckCount / totalCheckCount) * 100)
                : isDone
                ? 100
                : 0;

            return (
              <div
                key={task.id}
                className={cn(
                  "transition-colors",
                  task.isPinned && !isDone
                    ? "bg-[#F0EFFF]/25"
                    : "bg-white hover:bg-[#F7F8FA]/80"
                )}
              >
                {/* Main Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3">
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    {/* Expand Checklist Toggle */}
                    <button
                      type="button"
                      onClick={() => toggleExpand(task.id)}
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-[#737987] hover:bg-[#EAECF0]"
                      title="Toggle checklist & steps"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                    </button>

                    {/* Done Checkbox */}
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateTask(task.id, {
                          status: isDone ? "TODO" : "DONE",
                        })
                      }
                      className="mt-0.5 shrink-0 text-[#737987] hover:text-[#635BDB]"
                    >
                      {isDone ? (
                        <CheckCircle2 className="h-4 w-4 text-[#16A34A]" />
                      ) : (
                        <Circle className="h-4 w-4" />
                      )}
                    </button>

                    {/* Title & Meta */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openTaskDrawer(task)}
                          className={cn(
                            "text-left text-[13.5px] font-medium hover:text-[#5148C9] transition-colors",
                            isDone
                              ? "line-through text-[#9CA3AF]"
                              : "text-[#20232B]"
                          )}
                        >
                          {task.title}
                        </button>

                        <span
                          className={cn(
                            "rounded-[4px] border px-1.5 py-0.5 text-[10.5px] font-medium",
                            CATEGORY_STYLES[task.category] ||
                              CATEGORY_STYLES.General
                          )}
                        >
                          {task.category}
                        </span>

                        {totalCheckCount > 0 && (
                          <button
                            type="button"
                            onClick={() => toggleExpand(task.id)}
                            className="inline-flex items-center gap-1 rounded bg-[#F3F4F6] px-1.5 py-0.5 text-[10.5px] font-medium text-[#525866] hover:bg-[#E5E7EB]"
                          >
                            <ListChecks className="h-3 w-3" />
                            {doneCheckCount}/{totalCheckCount}
                          </button>
                        )}
                      </div>

                      {task.notes && (
                        <p className="mt-0.5 text-xs text-[#737987] line-clamp-1">
                          {task.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right Controls */}
                  <div className="flex flex-wrap items-center gap-2 sm:shrink-0 pl-12 sm:pl-0">
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateTask(task.id, { isPinned: !task.isPinned })
                      }
                      className={cn(
                        "rounded p-1 transition-colors",
                        task.isPinned
                          ? "text-[#635BDB] bg-[#F0EFFF]"
                          : "text-[#9CA3AF] hover:text-[#20232B] hover:bg-[#F3F4F6]"
                      )}
                      title={task.isPinned ? "Unpin" : "Pin to top"}
                    >
                      <Pin className="h-3.5 w-3.5" />
                    </button>

                    <PriorityBadge priority={task.priority} />

                    <Select
                      value={task.status}
                      onValueChange={(v) =>
                        handleUpdateTask(task.id, { status: v as TaskStatus })
                      }
                    >
                      <SelectTrigger className="h-7 w-[120px] text-xs px-2">
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

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-[#737987]"
                      onClick={() => openTaskDrawer(task)}
                      title="Edit details & notes"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-[#9CA3AF] hover:text-red-600 hover:bg-red-50"
                      onClick={() => handleDeleteTask(task.id)}
                      title="Delete personal task"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Expandable Personal Checklist Section */}
                {isExpanded && (
                  <div className="border-t border-[#F1F3F7] bg-[#FAFBFC] pl-12 pr-4 py-3 space-y-2">
                    {totalCheckCount > 0 && (
                      <div className="flex items-center gap-3 max-w-md mb-1">
                        <Progress value={checkPct} className="h-1 flex-1" />
                        <span className="text-[11px] font-medium text-[#737987]">
                          {checkPct}%
                        </span>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      {task.checklist.map((item) => (
                        <div
                          key={item.id}
                          className="group flex items-center justify-between gap-2 rounded px-2 py-1 hover:bg-white text-xs"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              handleToggleChecklistItem(task.id, item.id)
                            }
                            className="flex items-center gap-2 text-left flex-1 min-w-0"
                          >
                            {item.completed ? (
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#16A34A]" />
                            ) : (
                              <Circle className="h-3.5 w-3.5 shrink-0 text-[#9CA3AF]" />
                            )}
                            <span
                              className={cn(
                                "truncate",
                                item.completed
                                  ? "line-through text-[#9CA3AF]"
                                  : "text-[#374151]"
                              )}
                            >
                              {item.title}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleRemoveChecklistItem(task.id, item.id)
                            }
                            className="opacity-0 group-hover:opacity-100 text-[#9CA3AF] hover:text-red-600"
                            title="Remove step"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Inline Add Step */}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleAddChecklistItem(
                          task.id,
                          newCheckText[task.id] || ""
                        );
                      }}
                      className="flex items-center gap-2 max-w-md pt-1"
                    >
                      <Input
                        value={newCheckText[task.id] || ""}
                        onChange={(e) =>
                          setNewCheckText((prev) => ({
                            ...prev,
                            [task.id]: e.target.value,
                          }))
                        }
                        placeholder="Add a checklist item..."
                        className="h-7 text-xs bg-white"
                      />
                      <Button
                        type="submit"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs px-2.5"
                      >
                        Add Step
                      </Button>
                    </form>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Personal Kanban Board View with Grab & Drag */
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={(event: DragStartEvent) => {
            const found = tasks.find((t) => t.id === event.active.id);
            if (found) {
              setActiveDragTask(found);
              dragInitialStatusRef.current = found.status;
              dragSnapshotRef.current = tasks;
            }
          }}
          onDragOver={(event: DragOverEvent) => {
            const { active, over } = event;
            if (!over) return;
            const activeId = String(active.id);
            const overId = String(over.id);
            if (activeId === overId) return;

            const current = tasks.find((t) => t.id === activeId);
            if (!current) return;

            const targetStatus = COLUMNS.some((c) => c.id === overId)
              ? (overId as TaskStatus)
              : tasks.find((t) => t.id === overId)?.status;
            if (!targetStatus) return;

            if (current.status !== targetStatus) {
              setTasks((prev) =>
                prev.map((t) =>
                  t.id === activeId ? { ...t, status: targetStatus } : t
                )
              );
            } else {
              const oldIndex = tasks.findIndex((t) => t.id === activeId);
              const newIndex = tasks.findIndex((t) => t.id === overId);
              if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
                setTasks((prev) => arrayMove(prev, oldIndex, newIndex));
              }
            }
          }}
          onDragEnd={async (event: DragEndEvent) => {
            const { active, over } = event;
            const draggedId = String(active.id);
            const current = tasks.find((t) => t.id === draggedId);
            const startStatus = dragInitialStatusRef.current;

            setActiveDragTask(null);
            dragInitialStatusRef.current = null;

            if (!over || !current) {
              setTasks(dragSnapshotRef.current);
              return;
            }

            const overId = String(over.id);
            const targetStatus =
              (COLUMNS.some((c) => c.id === overId)
                ? (overId as TaskStatus)
                : tasks.find((t) => t.id === overId)?.status) || current.status;

            if (startStatus !== targetStatus) {
              const res = await updatePersonalTaskAction({
                id: draggedId,
                status: targetStatus,
              });
              if (res.error) {
                setTasks(dragSnapshotRef.current);
                toast.error(res.error);
                return;
              }
              toast.success(
                `Moved to ${STATUS_CONFIG[targetStatus].label}`
              );
              router.refresh();
            }
          }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
            {COLUMNS.map((col) => (
              <PersonalKanbanColumn
                key={col.id}
                column={col}
                tasks={filteredTasks.filter((t) => t.status === col.id)}
                onSelect={openTaskDrawer}
                onStatusChange={(id, status) =>
                  handleUpdateTask(id, { status })
                }
              />
            ))}
          </div>

          <DragOverlay>
            {activeDragTask ? (
              <PersonalKanbanCard
                task={activeDragTask}
                onSelect={() => {}}
                onStatusChange={() => {}}
                isOverlay
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Personal Task Detail & Scratchpad Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="p-0 flex flex-col" hideClose>
          <SheetTitle className="sr-only">Personal Task Details</SheetTitle>

          {selectedTask && (
            <>
              <div className="flex items-center justify-between border-b border-[#EAECF0] px-6 py-3.5">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded bg-[#F0EFFF] px-2 py-0.5 text-[11px] font-medium text-[#5148C9]">
                    <Lock className="h-3 w-3" />
                    Personal Task
                  </span>
                  {savingDetail && (
                    <span className="text-[11px] text-[#737987] flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Saving
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-8 w-8",
                      selectedTask.isPinned
                        ? "text-[#635BDB] bg-[#F0EFFF]"
                        : "text-[#737987]"
                    )}
                    onClick={() =>
                      handleUpdateTask(selectedTask.id, {
                        isPinned: !selectedTask.isPinned,
                      })
                    }
                    title="Pin task"
                  >
                    <Pin className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-[#737987] hover:text-red-600 hover:bg-red-50"
                    onClick={() => handleDeleteTask(selectedTask.id)}
                    title="Delete task"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setDrawerOpen(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
                {/* Editable Title */}
                <div>
                  <Label className="text-[11px] uppercase tracking-wider text-[#9CA3AF]">
                    Title
                  </Label>
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={async () => {
                      if (
                        editTitle.trim() &&
                        editTitle.trim() !== selectedTask.title
                      ) {
                        setSavingDetail(true);
                        await handleUpdateTask(selectedTask.id, {
                          title: editTitle.trim(),
                        });
                        setSavingDetail(false);
                      }
                    }}
                    className="mt-1 text-base font-semibold"
                  />
                </div>

                {/* Metadata Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg border border-[#EAECF0] bg-[#F7F8FA] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-[#737987]">Status</span>
                    <Select
                      value={selectedTask.status}
                      onValueChange={(v) =>
                        handleUpdateTask(selectedTask.id, {
                          status: v as TaskStatus,
                        })
                      }
                    >
                      <SelectTrigger className="h-8 w-[145px] text-xs bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TODO">To Do</SelectItem>
                        <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                        <SelectItem value="IN_REVIEW">In Review</SelectItem>
                        <SelectItem value="DONE">Done</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-[#737987]">Priority</span>
                    <Select
                      value={selectedTask.priority}
                      onValueChange={(v) =>
                        handleUpdateTask(selectedTask.id, {
                          priority: v as Priority,
                        })
                      }
                    >
                      <SelectTrigger className="h-8 w-[145px] text-xs bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LOW">Low</SelectItem>
                        <SelectItem value="MEDIUM">Medium</SelectItem>
                        <SelectItem value="HIGH">High</SelectItem>
                        <SelectItem value="URGENT">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-[#737987]">Category</span>
                    <Select
                      value={selectedTask.category}
                      onValueChange={(v) =>
                        handleUpdateTask(selectedTask.id, { category: v })
                      }
                    >
                      <SelectTrigger className="h-8 w-[145px] text-xs bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 text-xs text-[#737987]">
                      <Calendar className="h-3.5 w-3.5" /> Due Date
                    </span>
                    <DatePicker
                      minDate={getServerTodayStr()}
                      value={
                        selectedTask.dueDate
                          ? selectedTask.dueDate.slice(0, 10)
                          : ""
                      }
                      placeholder="Set due date"
                      align="end"
                      onChange={(val) =>
                        handleUpdateTask(selectedTask.id, {
                          dueDate: val || null,
                        })
                      }
                      className="h-8 w-[150px] text-xs bg-white"
                    />
                  </div>
                </div>

                {/* Personal Notes / Scratchpad */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#737987]">
                      <StickyNote className="h-3.5 w-3.5" />
                      Personal Notes &amp; Scratchpad
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={async () => {
                        setSavingDetail(true);
                        await handleUpdateTask(selectedTask.id, {
                          notes: editNotes,
                        });
                        setSavingDetail(false);
                        toast.success("Notes saved");
                      }}
                    >
                      Save Notes
                    </Button>
                  </div>
                  <Textarea
                    rows={5}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Jot down private notes, meeting links, or key reminders..."
                  />
                </div>

                {/* Personal Checklist */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#737987]">
                      <ListChecks className="h-3.5 w-3.5" />
                      Checklist ({
                        selectedTask.checklist.filter((c) => c.completed).length
                      }
                      /{selectedTask.checklist.length})
                    </span>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleAddChecklistItem(selectedTask.id, drawerCheckInput);
                      setDrawerCheckInput("");
                    }}
                    className="flex items-center gap-2"
                  >
                    <Input
                      value={drawerCheckInput}
                      onChange={(e) => setDrawerCheckInput(e.target.value)}
                      placeholder="Add a checklist item..."
                      className="h-8 text-xs"
                    />
                    <Button type="submit" size="sm" className="h-8">
                      <Plus className="h-3.5 w-3.5" />
                      Add
                    </Button>
                  </form>

                  {selectedTask.checklist.length === 0 ? (
                    <div className="rounded-md border border-dashed border-[#E2E6EE] py-6 text-center text-xs text-[#737987]">
                      No checklist steps yet.
                    </div>
                  ) : (
                    <div className="divide-y divide-[#EAECF0] rounded-lg border border-[#EAECF0] bg-white">
                      {selectedTask.checklist.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-2 px-3.5 py-2.5 text-xs"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              handleToggleChecklistItem(
                                selectedTask.id,
                                item.id
                              )
                            }
                            className="flex items-center gap-2.5 text-left flex-1"
                          >
                            {item.completed ? (
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-[#16A34A]" />
                            ) : (
                              <Circle className="h-4 w-4 shrink-0 text-[#9CA3AF]" />
                            )}
                            <span
                              className={cn(
                                item.completed
                                  ? "line-through text-[#9CA3AF]"
                                  : "text-[#20232B] font-medium"
                              )}
                            >
                              {item.title}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleRemoveChecklistItem(
                                selectedTask.id,
                                item.id
                              )
                            }
                            className="text-[#9CA3AF] hover:text-red-600 p-1"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
