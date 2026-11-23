"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Flag,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { MilestoneItem, TaskListItem } from "@/types";
import {
  createMilestoneAction,
  deleteMilestoneAction,
  updateMilestoneAction,
} from "@/actions/milestones";
import { cn, formatShortDate, isTaskOverdue } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { DatePicker } from "@/components/ui/date-picker";
import { UserAvatar } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PriorityBadge, TaskStatusBadge } from "@/components/shared/badges";
import { PaginationBar } from "@/components/shared/pagination-bar";

const MILESTONE_STATUS_CONFIG = {
  UPCOMING: {
    label: "Upcoming",
    bg: "bg-slate-100 text-slate-700 border-slate-200",
    dot: "bg-slate-400",
  },
  IN_PROGRESS: {
    label: "In Progress",
    bg: "bg-blue-50 text-blue-700 border-blue-200",
    dot: "bg-blue-500",
  },
  COMPLETED: {
    label: "Completed",
    bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
  },
} as const;

interface ProjectMilestonesTabProps {
  projectId: string;
  milestones: MilestoneItem[];
  projectTasks: TaskListItem[];
  canManage: boolean;
}

export function ProjectMilestonesTab({
  projectId,
  milestones,
  projectTasks,
  canManage,
}: ProjectMilestonesTabProps) {
  const router = useRouter();
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MilestoneItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 6;

  const totalPages = Math.max(1, Math.ceil(milestones.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedMilestones = milestones.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"UPCOMING" | "IN_PROGRESS" | "COMPLETED">(
    "UPCOMING"
  );
  const [dueDate, setDueDate] = useState("");
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [taskSearch, setTaskSearch] = useState("");

  const todayStr = new Date().toLocaleDateString("en-CA");

  const stats = useMemo(() => {
    const total = milestones.length;
    const completed = milestones.filter((m) => m.status === "COMPLETED").length;
    const inProgress = milestones.filter(
      (m) => m.status === "IN_PROGRESS"
    ).length;
    const overdue = milestones.filter(
      (m) => m.status !== "COMPLETED" && isTaskOverdue(m.dueDate, "TODO")
    ).length;
    return { total, completed, inProgress, overdue };
  }, [milestones]);

  const filteredTasks = useMemo(() => {
    const q = taskSearch.trim().toLowerCase();
    if (!q) return projectTasks;
    return projectTasks.filter(
      (t) =>
        t.taskKey.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q)
    );
  }, [projectTasks, taskSearch]);

  const openCreateDialog = () => {
    setEditing(null);
    setTitle("");
    setDescription("");
    setStatus("UPCOMING");
    setDueDate("");
    setSelectedTaskIds([]);
    setTaskSearch("");
    setDialogOpen(true);
  };

  const openEditDialog = (m: MilestoneItem) => {
    setEditing(m);
    setTitle(m.title);
    setDescription(m.description || "");
    setStatus(m.status);
    setDueDate(m.dueDate ? m.dueDate.slice(0, 10) : "");
    setSelectedTaskIds(m.tasks.map((t) => t.id));
    setTaskSearch("");
    setDialogOpen(true);
  };

  const toggleTaskLink = (tid: string) => {
    setSelectedTaskIds((prev) =>
      prev.includes(tid) ? prev.filter((id) => id !== tid) : [...prev, tid]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (trimmed.length < 2) {
      toast.error("Milestone title must be at least 2 characters.");
      return;
    }

    setSaving(true);
    const res = editing
      ? await updateMilestoneAction({
          id: editing.id,
          title: trimmed,
          description: description || null,
          status,
          dueDate: dueDate || null,
          taskIds: selectedTaskIds,
        })
      : await createMilestoneAction({
          projectId,
          title: trimmed,
          description: description || null,
          status,
          dueDate: dueDate || null,
          taskIds: selectedTaskIds,
        });
    setSaving(false);

    if (res.error) {
      toast.error(res.error);
      return;
    }

    toast.success(editing ? "Milestone updated" : "Milestone created");
    setDialogOpen(false);
    router.refresh();
  };

  const handleToggleComplete = async (m: MilestoneItem) => {
    const nextStatus = m.status === "COMPLETED" ? "IN_PROGRESS" : "COMPLETED";
    const res = await updateMilestoneAction({ id: m.id, status: nextStatus });
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(
      nextStatus === "COMPLETED"
        ? `Marked "${m.title}" as completed`
        : `Reopened "${m.title}"`
    );
    router.refresh();
  };

  const handleDelete = async (m: MilestoneItem) => {
    setDeletingId(m.id);
    const res = await deleteMilestoneAction(m.id);
    setDeletingId(null);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(`Deleted milestone "${m.title}"`);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      {/* Header & Summary */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-md border border-[#EAECF0] bg-white px-2.5 py-1 font-medium text-[#20232B]">
            Total: {stats.total}
          </span>
          <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">
            Completed: {stats.completed}
          </span>
          <span className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 font-medium text-blue-700">
            In Progress: {stats.inProgress}
          </span>
          {stats.overdue > 0 && (
            <span className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1 font-medium text-red-700">
              Overdue: {stats.overdue}
            </span>
          )}
        </div>

        {canManage && (
          <Button size="sm" onClick={openCreateDialog}>
            <Plus className="h-3.5 w-3.5" />
            New Milestone
          </Button>
        )}
      </div>

      {/* Milestones List */}
      {milestones.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#D9DEE7] bg-white py-14 text-center">
          <Flag className="mx-auto h-6 w-6 text-[#9CA3AF] mb-2" />
          <p className="text-sm font-medium text-[#20232B]">No milestones yet</p>
          <p className="mt-1 text-xs text-[#737987] max-w-sm mx-auto">
            Group key deliverables and deadlines into milestones to track phase
            releases and launch readiness.
          </p>
          {canManage && (
            <Button
              size="sm"
              variant="outline"
              className="mt-4"
              onClick={openCreateDialog}
            >
              <Plus className="h-3.5 w-3.5" />
              Create First Milestone
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {paginatedMilestones.map((m) => {
            const cfg = MILESTONE_STATUS_CONFIG[m.status];
            const overdue =
              m.status !== "COMPLETED" &&
              isTaskOverdue(m.dueDate, "TODO");
            const isExpanded = !!expandedIds[m.id];

            return (
              <div
                key={m.id}
                className="rounded-lg border border-[#EAECF0] bg-white shadow-subtle overflow-hidden"
              >
                <div className="p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div
                        className={cn(
                          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                          m.status === "COMPLETED"
                            ? "bg-emerald-50 text-emerald-600"
                            : overdue
                            ? "bg-red-50 text-red-600"
                            : "bg-[#F0EFFF] text-[#635BDB]"
                        )}
                      >
                        <Flag className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-[15px] font-semibold text-[#20232B] break-words">
                            {m.title}
                          </h3>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                              cfg.bg
                            )}
                          >
                            <span
                              className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)}
                            />
                            {cfg.label}
                          </span>
                          {overdue && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
                              <AlertTriangle className="h-3 w-3" />
                              Overdue
                            </span>
                          )}
                        </div>

                        {m.description && (
                          <p className="mt-1.5 text-xs text-[#525866] leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                            {m.description}
                          </p>
                        )}

                        <div className="mt-2.5 flex flex-wrap items-center gap-4 text-xs text-[#737987]">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1",
                              overdue && "text-red-600 font-medium"
                            )}
                          >
                            <Calendar className="h-3.5 w-3.5" />
                            Target:{" "}
                            {m.dueDate ? formatShortDate(m.dueDate) : "No date"}
                          </span>
                          <span>
                            {m.taskStats.completed}/{m.taskStats.total} linked{" "}
                            {m.taskStats.total === 1 ? "task" : "tasks"} done
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right progress + actions */}
                    <div className="flex flex-col sm:items-end gap-2.5 shrink-0 sm:min-w-[200px]">
                      {canManage && (
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2.5 text-xs"
                            onClick={() => handleToggleComplete(m)}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {m.status === "COMPLETED" ? "Reopen" : "Complete"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openEditDialog(m)}
                            title="Edit milestone"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-[#737987] hover:text-red-600 hover:bg-red-50"
                            disabled={deletingId === m.id}
                            onClick={() => handleDelete(m)}
                            title="Delete milestone"
                          >
                            {deletingId === m.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      )}

                      <div className="w-full sm:w-48">
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="text-[#737987]">Progress</span>
                          <span className="font-semibold text-[#20232B]">
                            {m.taskStats.progress}%
                          </span>
                        </div>
                        <Progress
                          value={m.taskStats.progress}
                          className="h-1.5"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Expand Linked Tasks */}
                  {m.tasks.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-[#F1F3F7]">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedIds((prev) => ({
                            ...prev,
                            [m.id]: !prev[m.id],
                          }))
                        }
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#525866] hover:text-[#635BDB]"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )}
                        {isExpanded ? "Hide" : "Show"} linked tasks (
                        {m.tasks.length})
                      </button>

                      {isExpanded && (
                        <div className="mt-2.5 divide-y divide-[#F1F3F7] rounded-md border border-[#EAECF0] bg-[#FAFBFC]">
                          {m.tasks.map((t) => (
                            <div
                              key={t.id}
                              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs"
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <span className="font-mono text-[11px] text-[#9CA3AF] shrink-0">
                                  {t.taskKey}
                                </span>
                                <span className="truncate font-medium text-[#20232B]">
                                  {t.title}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {t.assignee && (
                                  <UserAvatar
                                    name={t.assignee.name}
                                    avatarUrl={t.assignee.avatarUrl}
                                    size="xs"
                                  />
                                )}
                                <TaskStatusBadge status={t.status} />
                                <PriorityBadge
                                  priority={t.priority}
                                  showLabel={false}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <PaginationBar
        currentPage={safePage}
        totalItems={milestones.length}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        itemLabel="milestones"
      />

      {/* Create / Edit Milestone Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Milestone" : "Create Milestone"}
            </DialogTitle>
            <DialogDescription>
              Define a target deliverable and link project tasks to track
              automatic completion progress.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ms-title">
                Milestone Title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="ms-title"
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Phase 1 Beta Launch"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ms-desc">Description</Label>
              <Textarea
                id="ms-desc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Key objectives and acceptance criteria for this milestone..."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={status}
                  onValueChange={(v) =>
                    setStatus(v as "UPCOMING" | "IN_PROGRESS" | "COMPLETED")
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UPCOMING">Upcoming</SelectItem>
                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Target Date</Label>
                <DatePicker
                  value={dueDate}
                  minDate={editing ? undefined : todayStr}
                  placeholder="Select target date"
                  onChange={setDueDate}
                />
              </div>
            </div>

            {/* Link Project Tasks */}
            {projectTasks.length > 0 && (
              <div className="space-y-2 rounded-lg border border-[#EAECF0] bg-[#F7F8FA] p-3">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs font-semibold text-[#20232B]">
                    Linked Tasks ({selectedTaskIds.length} selected)
                  </Label>
                  {selectedTaskIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedTaskIds([])}
                      className="text-[11px] font-medium text-[#737987] hover:text-[#20232B]"
                    >
                      Clear all
                    </button>
                  )}
                </div>

                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#9CA3AF]" />
                  <Input
                    value={taskSearch}
                    onChange={(e) => setTaskSearch(e.target.value)}
                    placeholder="Filter project tasks..."
                    className="h-8 pl-8 text-xs bg-white"
                  />
                </div>

                <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                  {filteredTasks.map((t) => {
                    const active = selectedTaskIds.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => toggleTaskLink(t.id)}
                        className={cn(
                          "w-full flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors",
                          active
                            ? "border-[#635BDB] bg-[#F0EFFF] text-[#5148C9]"
                            : "border-[#EAECF0] bg-white text-[#20232B] hover:bg-[#F7F8FA]"
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                            active
                              ? "border-[#635BDB] bg-[#635BDB] text-white"
                              : "border-[#D5D9E2] bg-white"
                          )}
                        >
                          {active && <Check className="h-3 w-3" />}
                        </span>
                        <span className="font-mono text-[11px] shrink-0">
                          {t.taskKey}
                        </span>
                        <span className="truncate flex-1">{t.title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {editing ? "Save Changes" : "Create Milestone"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
