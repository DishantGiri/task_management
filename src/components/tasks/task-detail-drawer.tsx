"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AtSign,
  Calendar,
  Check,
  CheckCircle2,
  Circle,
  Download,
  GitBranch,
  Link2,
  Loader2,
  MessageSquare,
  Paperclip,
  Plus,
  Send,
  Tag,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { Priority, Role, TaskStatus } from "@prisma/client";
import type { TagSummary, TaskDetailData, UserSummary } from "@/types";
import {
  addTaskCommentAction,
  createTaskAction,
  deleteAttachmentAction,
  deleteTaskAction,
  updateTaskAction,
} from "@/actions/tasks";
import {
  cn,
  formatCompactDate,
  formatFileSize,
  formatRelativeTime,
  isTaskOverdue,
} from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { UserAvatar } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PriorityBadge, TaskStatusBadge } from "@/components/shared/badges";

interface TaskDetailDrawerProps {
  taskId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: string;
  currentUserRole: Role;
  users: UserSummary[];
  tags: TagSummary[];
  allProjectTasks?: { id: string; taskKey: string; title: string }[];
  onUpdated?: () => void;
}

export function TaskDetailDrawer({
  taskId,
  open,
  onOpenChange,
  currentUserId,
  currentUserRole,
  users,
  tags,
  allProjectTasks = [],
  onUpdated,
}: TaskDetailDrawerProps) {
  const router = useRouter();
  const [task, setTask] = useState<TaskDetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [editingDesc, setEditingDesc] = useState(false);

  // Subtask quick add
  const [showSubtaskForm, setShowSubtaskForm] = useState(false);
  const [subTitle, setSubTitle] = useState("");
  const [subAssigneeId, setSubAssigneeId] = useState<string>("");
  const [subPriority, setSubPriority] = useState<Priority>("MEDIUM");
  const [subDueDate, setSubDueDate] = useState("");
  const [addingSubtask, setAddingSubtask] = useState(false);

  // Comment state
  const [commentText, setCommentText] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [showMentionList, setShowMentionList] = useState(false);

  // File upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Delete dialog
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadTask = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tasks/${id}`, { cache: "no-store" });
      if (!res.ok) {
        toast.error("Could not load task details");
        setTask(null);
        return;
      }
      const json = await res.json();
      setTask(json.data);
      setTitle(json.data.title);
      setDescription(json.data.description || "");
    } catch {
      toast.error("Failed to fetch task details");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && taskId) {
      loadTask(taskId);
      setEditingDesc(false);
      setShowSubtaskForm(false);
    }
  }, [open, taskId, loadTask]);

  const canFullEdit =
    currentUserRole === "ADMIN" ||
    currentUserRole === "MANAGER" ||
    (task?.parentId !== null &&
      (task?.assigneeId === currentUserId ||
        task?.creatorId === currentUserId));

  const canUpdateStatus =
    canFullEdit ||
    task?.assigneeId === currentUserId ||
    task?.collaborators.some((c) => c.user.id === currentUserId);

  const handleFieldUpdate = async (patch: Record<string, unknown>) => {
    if (!task) return;
    setSaving(true);
    const res = await updateTaskAction({ id: task.id, ...patch });
    setSaving(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    await loadTask(task.id);
    onUpdated?.();
    router.refresh();
  };

  const handleSubtaskStatusToggle = async (
    subtaskId: string,
    currentStatus: TaskStatus
  ) => {
    const nextStatus: TaskStatus = currentStatus === "DONE" ? "TODO" : "DONE";
    const res = await updateTaskAction({ id: subtaskId, status: nextStatus });
    if (res.error) {
      toast.error(res.error);
      return;
    }
    if (task) await loadTask(task.id);
    onUpdated?.();
    router.refresh();
  };

  const handleSubtaskStatusChange = async (
    subtaskId: string,
    nextStatus: TaskStatus
  ) => {
    const res = await updateTaskAction({ id: subtaskId, status: nextStatus });
    if (res.error) {
      toast.error(res.error);
      return;
    }
    if (task) await loadTask(task.id);
    onUpdated?.();
    router.refresh();
  };

  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || !subTitle.trim()) return;
    setAddingSubtask(true);
    const res = await createTaskAction({
      title: subTitle.trim(),
      projectId: task.projectId,
      parentId: task.id,
      status: "TODO",
      priority: subPriority,
      assigneeId: subAssigneeId || null,
      dueDate: subDueDate || null,
      collaboratorIds: [],
      tagIds: [],
      dependencyIds: [],
    });
    setAddingSubtask(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(`Subtask ${res.taskKey} added`);
    setSubTitle("");
    setSubAssigneeId("");
    setSubPriority("MEDIUM");
    setSubDueDate("");
    setShowSubtaskForm(false);
    await loadTask(task.id);
    onUpdated?.();
    router.refresh();
  };

  const handleDeleteSubtask = async (subId: string) => {
    const res = await deleteTaskAction(subId);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Subtask removed");
    if (task) await loadTask(task.id);
    onUpdated?.();
    router.refresh();
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || !commentText.trim()) return;
    setPostingComment(true);
    const res = await addTaskCommentAction({
      taskId: task.id,
      content: commentText.trim(),
    });
    setPostingComment(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setCommentText("");
    setShowMentionList(false);
    await loadTask(task.id);
    onUpdated?.();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !task) return;
    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("taskId", task.id);

      const res = await fetch("/api/attachments", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Upload failed");
        return;
      }
      toast.success(`Uploaded ${file.name}`);
      await loadTask(task.id);
      onUpdated?.();
    } catch {
      toast.error("File upload failed");
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteAttachment = async (attId: string) => {
    const res = await deleteAttachmentAction(attId);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Attachment deleted");
    if (task) await loadTask(task.id);
  };

  const handleDeleteTask = async () => {
    if (!task) return;
    setDeleting(true);
    const res = await deleteTaskAction(task.id);
    setDeleting(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(`Deleted ${task.taskKey}`);
    setConfirmDelete(false);
    onOpenChange(false);
    onUpdated?.();
    router.refresh();
  };

  const toggleCollaborator = (uid: string) => {
    if (!task) return;
    const current = task.collaborators.map((c) => c.user.id);
    const next = current.includes(uid)
      ? current.filter((id) => id !== uid)
      : [...current, uid];
    handleFieldUpdate({ collaboratorIds: next });
  };

  const toggleTag = (tagId: string) => {
    if (!task) return;
    const current = task.tags.map((t) => t.tag.id);
    const next = current.includes(tagId)
      ? current.filter((id) => id !== tagId)
      : [...current, tagId];
    handleFieldUpdate({ tagIds: next });
  };

  const toggleDependency = (depId: string) => {
    if (!task) return;
    const current = task.dependencies.map((d) => d.dependsOnId);
    const next = current.includes(depId)
      ? current.filter((id) => id !== depId)
      : [...current, depId];
    handleFieldUpdate({ dependencyIds: next });
  };

  const insertMention = (name: string) => {
    const first = name.split(" ")[0];
    setCommentText((prev) => `${prev}${prev.endsWith(" ") || prev === "" ? "" : " "}@${first} `);
    setShowMentionList(false);
  };

  const renderCommentText = (text: string) => {
    const parts = text.split(/(@[A-Za-z][A-Za-z0-9._-]*)/g);
    return parts.map((part, i) =>
      part.startsWith("@") ? (
        <span
          key={i}
          className="rounded bg-[#F0EFFF] px-1 py-0.5 font-medium text-[#5148C9]"
        >
          {part}
        </span>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  const completedSubtasks =
    task?.subtasks.filter((s) => s.status === "DONE").length ?? 0;
  const totalSubtasks = task?.subtasks.length ?? 0;
  const todayStr = new Date().toLocaleDateString("en-CA");

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="p-0 flex flex-col" hideClose>
          <SheetTitle className="sr-only">Task Details</SheetTitle>

          {loading || !task ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-[#635BDB]" />
            </div>
          ) : (
            <>
              {/* Drawer Header */}
              <div className="flex items-center justify-between gap-3 border-b border-[#EAECF0] px-6 py-3.5 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                    style={{ backgroundColor: task.project.color }}
                  />
                  <span className="text-xs font-medium text-[#737987] truncate">
                    {task.project.name}
                  </span>
                  <span className="text-[#D1D5DB]">/</span>
                  <span className="font-mono text-xs font-semibold text-[#20232B]">
                    {task.taskKey}
                  </span>
                  {saving && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-[#737987] ml-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Saving
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  {canFullEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-[#737987] hover:text-red-600 hover:bg-red-50"
                      onClick={() => setConfirmDelete(true)}
                      title="Delete task"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onOpenChange(false)}
                    aria-label="Close drawer"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Scrollable Body */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
                {/* Parent Breadcrumb if subtask */}
                {task.parent && (
                  <button
                    type="button"
                    onClick={() => loadTask(task.parent!.id)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[#EAECF0] bg-[#F7F8FA] px-2.5 py-1 text-xs text-[#525866] hover:text-[#635BDB]"
                  >
                    <GitBranch className="h-3.5 w-3.5" />
                    Parent: <span className="font-mono">{task.parent.taskKey}</span>{" "}
                    {task.parent.title}
                  </button>
                )}

                {/* Title */}
                <div>
                  {canFullEdit ? (
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      onBlur={() => {
                        if (title.trim() && title.trim() !== task.title) {
                          handleFieldUpdate({ title: title.trim() });
                        }
                      }}
                      className="w-full text-[20px] font-semibold tracking-tight text-[#20232B] bg-transparent border border-transparent rounded px-1 -mx-1 hover:border-[#EAECF0] focus:border-[#635BDB] focus:bg-white focus:outline-none py-0.5"
                    />
                  ) : (
                    <h2 className="text-[20px] font-semibold tracking-tight text-[#20232B]">
                      {task.title}
                    </h2>
                  )}
                </div>

                {/* Metadata Properties Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg border border-[#EAECF0] bg-[#F7F8FA]/70 p-4">
                  {/* Status */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-[#737987]">Status</span>
                    <Select
                      value={task.status}
                      disabled={!canUpdateStatus}
                      onValueChange={(v) =>
                        handleFieldUpdate({ status: v as TaskStatus })
                      }
                    >
                      <SelectTrigger className="h-8 w-[150px] text-xs">
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

                  {/* Priority */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-[#737987]">Priority</span>
                    <Select
                      value={task.priority}
                      disabled={!canFullEdit}
                      onValueChange={(v) =>
                        handleFieldUpdate({ priority: v as Priority })
                      }
                    >
                      <SelectTrigger className="h-8 w-[150px] text-xs">
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

                  {/* Primary Assignee */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-[#737987]">Assignee</span>
                    <Select
                      value={task.assigneeId || "__unassigned__"}
                      disabled={!canFullEdit}
                      onValueChange={(v) =>
                        handleFieldUpdate({
                          assigneeId: v === "__unassigned__" ? null : v,
                        })
                      }
                    >
                      <SelectTrigger className="h-8 w-[150px] text-xs">
                        <SelectValue placeholder="Unassigned" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__unassigned__">Unassigned</SelectItem>
                        {users.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Progress */}
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-[#737987]">Progress</span>
                    <div className="flex items-center gap-2 w-[150px]">
                      <Progress value={task.progress} className="h-2 flex-1" />
                      <span className="text-xs font-semibold text-[#20232B] w-9 text-right">
                        {task.progress}%
                      </span>
                    </div>
                  </div>

                  {/* Start Date */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 text-xs text-[#737987]">
                      <Calendar className="h-3.5 w-3.5" /> Start
                    </span>
                    <Input
                      type="date"
                      disabled={!canFullEdit}
                      value={
                        task.startDate ? task.startDate.slice(0, 10) : ""
                      }
                      onChange={(e) =>
                        handleFieldUpdate({
                          startDate: e.target.value || null,
                        })
                      }
                      className="h-8 w-[150px] text-xs"
                    />
                  </div>

                  {/* Due Date */}
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 text-xs",
                        isTaskOverdue(task.dueDate, task.status)
                          ? "text-[#EF4444] font-medium"
                          : "text-[#737987]"
                      )}
                    >
                      <Calendar className="h-3.5 w-3.5" /> Due
                    </span>
                    <Input
                      type="date"
                      min={todayStr}
                      disabled={!canFullEdit}
                      value={task.dueDate ? task.dueDate.slice(0, 10) : ""}
                      onChange={(e) =>
                        handleFieldUpdate({ dueDate: e.target.value || null })
                      }
                      className="h-8 w-[150px] text-xs"
                    />
                  </div>
                </div>

                {/* Collaborators & Tags */}
                <div className="space-y-3">
                  {/* Collaborators */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#737987] w-28">
                      <Users className="h-3.5 w-3.5" /> Collaborators
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5 flex-1">
                      {users
                        .filter((u) => u.id !== task.assigneeId)
                        .map((u) => {
                          const active = task.collaborators.some(
                            (c) => c.user.id === u.id
                          );
                          if (!canFullEdit && !active) return null;
                          return (
                            <button
                              key={u.id}
                              type="button"
                              disabled={!canFullEdit}
                              onClick={() => toggleCollaborator(u.id)}
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors",
                                active
                                  ? "border-[#635BDB]/50 bg-[#F0EFFF] text-[#5148C9]"
                                  : "border-[#EAECF0] bg-white text-[#737987] hover:bg-[#F7F8FA]"
                              )}
                            >
                              <UserAvatar
                                name={u.name}
                                avatarUrl={u.avatarUrl}
                                size="xs"
                              />
                              {u.name}
                            </button>
                          );
                        })}
                      {!canFullEdit && task.collaborators.length === 0 && (
                        <span className="text-xs text-[#9CA3AF]">None</span>
                      )}
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#737987] w-28">
                      <Tag className="h-3.5 w-3.5" /> Tags
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5 flex-1">
                      {tags.map((tag) => {
                        const active = task.tags.some((t) => t.tag.id === tag.id);
                        if (!canFullEdit && !active) return null;
                        return (
                          <button
                            key={tag.id}
                            type="button"
                            disabled={!canFullEdit}
                            onClick={() => toggleTag(tag.id)}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-[5px] border px-2 py-0.5 text-[11px] font-medium transition-colors",
                              active
                                ? "border-[#635BDB]/50 bg-[#F0EFFF] text-[#5148C9]"
                                : "border-[#EAECF0] bg-white text-[#737987] hover:bg-[#F7F8FA]"
                            )}
                          >
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: tag.color }}
                            />
                            {tag.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Dependencies */}
                  {allProjectTasks.length > 1 && (
                    <div className="flex flex-wrap items-start gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#737987] w-28 pt-1">
                        <Link2 className="h-3.5 w-3.5" /> Blocked by
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5 flex-1">
                        {allProjectTasks
                          .filter((t) => t.id !== task.id)
                          .slice(0, 12)
                          .map((dep) => {
                            const active = task.dependencies.some(
                              (d) => d.dependsOnId === dep.id
                            );
                            if (!canFullEdit && !active) return null;
                            return (
                              <button
                                key={dep.id}
                                type="button"
                                disabled={!canFullEdit}
                                onClick={() => toggleDependency(dep.id)}
                                className={cn(
                                  "rounded-[5px] border px-2 py-0.5 text-[11px] font-medium transition-colors",
                                  active
                                    ? "border-amber-300 bg-amber-50 text-amber-800"
                                    : "border-[#EAECF0] bg-white text-[#737987] hover:bg-[#F7F8FA]"
                                )}
                              >
                                {dep.taskKey}
                              </button>
                            );
                          })}
                        {!canFullEdit && task.dependencies.length === 0 && (
                          <span className="text-xs text-[#9CA3AF]">None</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[#737987]">
                      Description
                    </h3>
                    {canFullEdit && !editingDesc && (
                      <button
                        type="button"
                        onClick={() => setEditingDesc(true)}
                        className="text-xs font-medium text-[#635BDB] hover:text-[#5148C9]"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                  {editingDesc ? (
                    <div className="space-y-2">
                      <Textarea
                        rows={4}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Add detailed task description..."
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={async () => {
                            await handleFieldUpdate({ description });
                            setEditingDesc(false);
                          }}
                        >
                          <Check className="h-3.5 w-3.5" />
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setDescription(task.description || "");
                            setEditingDesc(false);
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => canFullEdit && setEditingDesc(true)}
                      className={cn(
                        "rounded-md border border-[#EAECF0] bg-white p-3.5 text-[13px] leading-relaxed text-[#374151] whitespace-pre-wrap",
                        canFullEdit && "cursor-text hover:border-[#D1D5DB]"
                      )}
                    >
                      {task.description || (
                        <span className="text-[#9CA3AF]">
                          No description provided.{" "}
                          {canFullEdit ? "Click to add details." : ""}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Subtasks Section */}
                {!task.parentId && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#737987]">
                          Subtasks
                        </h3>
                        <span className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[11px] font-medium text-[#4B5563]">
                          {completedSubtasks}/{totalSubtasks}
                        </span>
                      </div>
                      {canUpdateStatus && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setShowSubtaskForm((v) => !v)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add Subtask
                        </Button>
                      )}
                    </div>

                    {totalSubtasks > 0 && (
                      <div className="flex items-center gap-3">
                        <Progress value={task.progress} className="h-1.5 flex-1" />
                        <span className="text-[11px] font-medium text-[#737987]">
                          {task.progress}% auto-calculated
                        </span>
                      </div>
                    )}

                    {/* Inline Add Subtask Form */}
                    {showSubtaskForm && (
                      <form
                        onSubmit={handleAddSubtask}
                        className="rounded-lg border border-[#635BDB]/30 bg-[#F0EFFF]/30 p-3 space-y-2.5"
                      >
                        <Input
                          value={subTitle}
                          onChange={(e) => setSubTitle(e.target.value)}
                          placeholder="Subtask title (e.g., Build hero section)"
                          autoFocus
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <Select
                            value={subAssigneeId || "__unassigned__"}
                            onValueChange={(v) =>
                              setSubAssigneeId(v === "__unassigned__" ? "" : v)
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Assignee" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__unassigned__">
                                Unassigned
                              </SelectItem>
                              {users.map((u) => (
                                <SelectItem key={u.id} value={u.id}>
                                  {u.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <Select
                            value={subPriority}
                            onValueChange={(v) => setSubPriority(v as Priority)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="LOW">Low</SelectItem>
                              <SelectItem value="MEDIUM">Medium</SelectItem>
                              <SelectItem value="HIGH">High</SelectItem>
                              <SelectItem value="URGENT">Urgent</SelectItem>
                            </SelectContent>
                          </Select>

                          <Input
                            type="date"
                            min={todayStr}
                            value={subDueDate}
                            onChange={(e) => setSubDueDate(e.target.value)}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setShowSubtaskForm(false)}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            size="sm"
                            disabled={addingSubtask || !subTitle.trim()}
                          >
                            {addingSubtask && (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            )}
                            Create Subtask
                          </Button>
                        </div>
                      </form>
                    )}

                    {/* Subtasks List */}
                    {totalSubtasks === 0 ? (
                      <div className="rounded-md border border-dashed border-[#E2E6EE] py-5 text-center text-xs text-[#737987]">
                        No subtasks yet. Break down work into smaller trackable steps.
                      </div>
                    ) : (
                      <div className="divide-y divide-[#EAECF0] rounded-lg border border-[#EAECF0] bg-white">
                        {task.subtasks.map((sub) => {
                          const isDone = sub.status === "DONE";
                          const overdue = isTaskOverdue(sub.dueDate, sub.status);
                          return (
                            <div
                              key={sub.id}
                              className="group flex items-center gap-2.5 px-3 py-2.5 hover:bg-[#F7F8FA] transition-colors"
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  handleSubtaskStatusToggle(sub.id, sub.status)
                                }
                                className="shrink-0 text-[#737987] hover:text-[#635BDB]"
                                title={
                                  isDone ? "Mark as To Do" : "Mark as Done"
                                }
                              >
                                {isDone ? (
                                  <CheckCircle2 className="h-4 w-4 text-[#16A34A]" />
                                ) : (
                                  <Circle className="h-4 w-4" />
                                )}
                              </button>

                              <div className="min-w-0 flex-1">
                                <button
                                  type="button"
                                  onClick={() => loadTask(sub.id)}
                                  className={cn(
                                    "text-left text-[13px] font-medium hover:text-[#635BDB] truncate block w-full",
                                    isDone
                                      ? "line-through text-[#9CA3AF]"
                                      : "text-[#20232B]"
                                  )}
                                >
                                  <span className="font-mono text-[11px] text-[#9CA3AF] mr-1.5">
                                    {sub.taskKey}
                                  </span>
                                  {sub.title}
                                </button>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <PriorityBadge
                                  priority={sub.priority}
                                  showLabel={false}
                                />
                                <Select
                                  value={sub.status}
                                  onValueChange={(v) =>
                                    handleSubtaskStatusChange(
                                      sub.id,
                                      v as TaskStatus
                                    )
                                  }
                                >
                                  <SelectTrigger className="h-6 w-[108px] text-[11px] px-2">
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
                                {sub.dueDate && (
                                  <span
                                    className={cn(
                                      "text-[11px] hidden sm:inline",
                                      overdue
                                        ? "text-[#EF4444] font-medium"
                                        : "text-[#737987]"
                                    )}
                                  >
                                    {formatCompactDate(sub.dueDate)}
                                  </span>
                                )}
                                {sub.assignee && (
                                  <UserAvatar
                                    name={sub.assignee.name}
                                    avatarUrl={sub.assignee.avatarUrl}
                                    size="xs"
                                  />
                                )}
                                {canUpdateStatus && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteSubtask(sub.id)}
                                    className="opacity-0 group-hover:opacity-100 rounded p-1 text-[#9CA3AF] hover:text-red-600 transition-opacity"
                                    title="Remove subtask"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Attachments Section */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-[#737987]">
                        Attachments
                      </h3>
                      <span className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[11px] font-medium text-[#4B5563]">
                        {task.attachments.length}
                      </span>
                    </div>
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={uploadingFile}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {uploadingFile ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Upload className="h-3.5 w-3.5" />
                        )}
                        Upload File
                      </Button>
                    </div>
                  </div>

                  {task.attachments.length === 0 ? (
                    <div className="rounded-md border border-dashed border-[#E2E6EE] py-4 text-center text-xs text-[#737987]">
                      No files attached (max 10MB per file).
                    </div>
                  ) : (
                    <div className="divide-y divide-[#EAECF0] rounded-lg border border-[#EAECF0] bg-white">
                      {task.attachments.map((att) => (
                        <div
                          key={att.id}
                          className="flex items-center justify-between gap-3 px-3 py-2.5"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Paperclip className="h-4 w-4 shrink-0 text-[#737987]" />
                            <div className="min-w-0">
                              <p className="truncate text-xs font-medium text-[#20232B]">
                                {att.fileName}
                              </p>
                              <p className="text-[11px] text-[#9CA3AF]">
                                {formatFileSize(att.fileSize)} · Uploaded by{" "}
                                {att.uploadedBy.name} ·{" "}
                                {formatRelativeTime(att.createdAt)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <a
                              href={att.fileUrl}
                              download
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#737987] hover:bg-[#F3F4F6] hover:text-[#20232B]"
                              title="Download"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </a>
                            <button
                              type="button"
                              onClick={() => handleDeleteAttachment(att.id)}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#737987] hover:bg-red-50 hover:text-red-600"
                              title="Delete file"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Comments & Activity Tabs */}
                <Tabs defaultValue="comments" className="w-full">
                  <TabsList className="w-full justify-start">
                    <TabsTrigger value="comments" className="gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5" />
                      Comments ({task.comments.length})
                    </TabsTrigger>
                    <TabsTrigger value="activity" className="gap-1.5">
                      <Activity className="h-3.5 w-3.5" />
                      Activity ({task.activityLogs.length})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="comments" className="space-y-4">
                    {/* Comments List */}
                    <div className="space-y-3">
                      {task.comments.length === 0 ? (
                        <p className="py-4 text-center text-xs text-[#737987]">
                          No comments yet. Use @name to mention a teammate.
                        </p>
                      ) : (
                        task.comments.map((c) => (
                          <div key={c.id} className="flex gap-2.5">
                            <UserAvatar
                              name={c.author.name}
                              avatarUrl={c.author.avatarUrl}
                              size="sm"
                              className="mt-0.5"
                            />
                            <div className="flex-1 rounded-lg border border-[#EAECF0] bg-[#F7F8FA]/70 px-3.5 py-2.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-semibold text-[#20232B]">
                                  {c.author.name}
                                </span>
                                <span className="text-[11px] text-[#9CA3AF]">
                                  {formatRelativeTime(c.createdAt)}
                                </span>
                              </div>
                              <p className="mt-1 text-[13px] leading-relaxed text-[#374151] whitespace-pre-wrap">
                                {renderCommentText(c.content)}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Comment Composer */}
                    <form onSubmit={handleAddComment} className="space-y-2">
                      <div className="relative">
                        <Textarea
                          rows={2}
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          placeholder="Write an update or @mention a colleague..."
                        />
                        {showMentionList && (
                          <div className="absolute bottom-full left-0 mb-1 z-20 w-56 rounded-md border border-[#EAECF0] bg-white p-1 shadow-lg max-h-40 overflow-y-auto">
                            {users.map((u) => (
                              <button
                                key={u.id}
                                type="button"
                                onClick={() => insertMention(u.name)}
                                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-[#F7F8FA]"
                              >
                                <UserAvatar
                                  name={u.name}
                                  avatarUrl={u.avatarUrl}
                                  size="xs"
                                />
                                <span className="truncate font-medium">
                                  {u.name}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setShowMentionList((v) => !v)}
                        >
                          <AtSign className="h-3.5 w-3.5" />
                          Mention teammate
                        </Button>
                        <Button
                          type="submit"
                          size="sm"
                          disabled={postingComment || !commentText.trim()}
                        >
                          {postingComment ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Send className="h-3.5 w-3.5" />
                          )}
                          Post Comment
                        </Button>
                      </div>
                    </form>
                  </TabsContent>

                  <TabsContent value="activity">
                    <div className="divide-y divide-[#EAECF0] rounded-lg border border-[#EAECF0] bg-white">
                      {task.activityLogs.length === 0 ? (
                        <p className="py-6 text-center text-xs text-[#737987]">
                          No activity recorded yet.
                        </p>
                      ) : (
                        task.activityLogs.map((log) => (
                          <div
                            key={log.id}
                            className="flex items-start gap-2.5 px-3.5 py-2.5 text-xs"
                          >
                            <UserAvatar
                              name={log.actor.name}
                              avatarUrl={log.actor.avatarUrl}
                              size="xs"
                              className="mt-0.5"
                            />
                            <div className="flex-1">
                              <span className="font-medium text-[#20232B]">
                                {log.actor.name}
                              </span>{" "}
                              <span className="text-[#525866]">
                                {log.description}
                              </span>
                              <p className="text-[10.5px] text-[#9CA3AF] mt-0.5">
                                {formatRelativeTime(log.createdAt)}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete task {task?.taskKey}?</DialogTitle>
            <DialogDescription>
              This permanently removes the task along with all subtasks,
              comments, and attachments.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteTask}
              disabled={deleting}
            >
              {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Delete Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
