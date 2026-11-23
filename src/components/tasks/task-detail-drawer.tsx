"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AtSign,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Circle,
  Download,
  ExternalLink,
  Eye,
  FileText,
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
  canUserMarkTaskComplete,
  cn,
  formatCompactDate,
  formatFileSize,
  formatRelativeTime,
  getDisplayTaskProgress,
  isTaskOverdue,
  validateTaskStatusTransition,
} from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import {
  BlockerPicker,
  type BlockerCandidate,
} from "@/components/tasks/blocker-picker";
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
  allProjectTasks?: BlockerCandidate[];
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

  // Editable draft fields (saved together when "Save Changes" is clicked)
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [editingDesc, setEditingDesc] = useState(false);
  const [draftStatus, setDraftStatus] = useState<TaskStatus>("TODO");
  const [draftPriority, setDraftPriority] = useState<Priority>("MEDIUM");
  const [draftAssigneeId, setDraftAssigneeId] = useState<string | null>(null);
  const [draftStartDate, setDraftStartDate] = useState("");
  const [draftDueDate, setDraftDueDate] = useState("");
  const [draftCollaboratorIds, setDraftCollaboratorIds] = useState<string[]>([]);
  const [draftTagIds, setDraftTagIds] = useState<string[]>([]);
  const [draftDependencyIds, setDraftDependencyIds] = useState<string[]>([]);

  // Subtask quick add
  const [showSubtaskForm, setShowSubtaskForm] = useState(false);
  const [subTitle, setSubTitle] = useState("");
  const [subAssigneeId, setSubAssigneeId] = useState<string>("");
  const [subPriority, setSubPriority] = useState<Priority>("MEDIUM");
  const [subDueDate, setSubDueDate] = useState("");
  const [addingSubtask, setAddingSubtask] = useState(false);

  // Comment & drawer subsection state
  const [activeSection, setActiveSection] = useState<"details" | "comments">(
    "details"
  );
  const [commentText, setCommentText] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [showMentionList, setShowMentionList] = useState(false);

  // File upload & preview state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<
    TaskDetailData["attachments"][number] | null
  >(null);
  const [previewTextContent, setPreviewTextContent] = useState<string | null>(
    null
  );
  const [loadingPreviewText, setLoadingPreviewText] = useState(false);

  const openAttachmentPreview = async (
    att: TaskDetailData["attachments"][number]
  ) => {
    setPreviewAttachment(att);
    setPreviewTextContent(null);
    const mime = (att.mimeType || "").toLowerCase();
    if (
      mime === "text/plain" ||
      mime === "text/csv" ||
      mime === "application/json" ||
      att.fileName.toLowerCase().endsWith(".md") ||
      att.fileName.toLowerCase().endsWith(".txt")
    ) {
      setLoadingPreviewText(true);
      try {
        const res = await fetch(`${att.fileUrl}?preview=1`);
        if (res.ok) {
          setPreviewTextContent(await res.text());
        }
      } catch {
        setPreviewTextContent("Unable to load text preview.");
      } finally {
        setLoadingPreviewText(false);
      }
    }
  };

  // Delete dialog
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [blockedSaveWarning, setBlockedSaveWarning] = useState<
    { taskKey: string; title: string }[] | null
  >(null);
  const needsBoardRefreshRef = useRef(false);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && needsBoardRefreshRef.current) {
      needsBoardRefreshRef.current = false;
      onUpdated?.();
      router.refresh();
    }
    onOpenChange(nextOpen);
  };

  const syncDraftFromTask = useCallback((data: TaskDetailData) => {
    setTitle(data.title);
    setDescription(data.description || "");
    setDraftStatus(data.status);
    setDraftPriority(data.priority);
    setDraftAssigneeId(data.assigneeId || null);
    setDraftStartDate(data.startDate ? data.startDate.slice(0, 10) : "");
    setDraftDueDate(data.dueDate ? data.dueDate.slice(0, 10) : "");
    setDraftCollaboratorIds(data.collaborators.map((c) => c.user.id));
    setDraftTagIds(data.tags.map((t) => t.tag.id));
    setDraftDependencyIds(data.dependencies.map((d) => d.dependsOnId));
  }, []);

  const loadTask = useCallback(
    async (
      id: string,
      options?: { silent?: boolean; preserveDraft?: boolean }
    ) => {
      if (!options?.silent) {
        setLoading(true);
      }
      try {
        const res = await fetch(`/api/tasks/${id}`, { cache: "no-store" });
        if (!res.ok) {
          toast.error("Could not load task details");
          if (!options?.silent) setTask(null);
          return;
        }
        const json = await res.json();
        setTask(json.data);
        if (!options?.preserveDraft) {
          syncDraftFromTask(json.data);
        }
      } catch {
        toast.error("Failed to fetch task details");
      } finally {
        if (!options?.silent) {
          setLoading(false);
        }
      }
    },
    [syncDraftFromTask]
  );

  useEffect(() => {
    if (open && taskId) {
      needsBoardRefreshRef.current = false;
      setActiveSection("details");
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

  const currentUserSummary = users.find((u) => u.id === currentUserId);
  const canMarkComplete = canUserMarkTaskComplete({
    role: currentUserRole,
    designation: currentUserSummary?.designation,
    departmentName: currentUserSummary?.department?.name,
  });

  const canUpdateStatus =
    canFullEdit ||
    canMarkComplete ||
    task?.assigneeId === currentUserId ||
    task?.collaborators.some((c) => c.user.id === currentUserId);

  const canDeleteAttachment =
    currentUserRole === "ADMIN" ||
    currentUserRole === "MANAGER" ||
    task?.project.managerId === currentUserId ||
    task?.assigneeId === currentUserId;

  const arraysEqual = (a: string[], b: string[]) => {
    if (a.length !== b.length) return false;
    const sa = [...a].sort();
    const sb = [...b].sort();
    return sa.every((v, i) => v === sb[i]);
  };

  const origStartDate = task?.startDate ? task.startDate.slice(0, 10) : "";
  const origDueDate = task?.dueDate ? task.dueDate.slice(0, 10) : "";
  const origCollaboratorIds = task ? task.collaborators.map((c) => c.user.id) : [];
  const origTagIds = task ? task.tags.map((t) => t.tag.id) : [];
  const origDependencyIds = task ? task.dependencies.map((d) => d.dependsOnId) : [];

  const hasUnsavedChanges = Boolean(
    task &&
      (draftStatus !== task.status ||
        (canFullEdit &&
          (title.trim() !== task.title ||
            (description || "") !== (task.description || "") ||
            draftPriority !== task.priority ||
            (draftAssigneeId || null) !== (task.assigneeId || null) ||
            draftStartDate !== origStartDate ||
            draftDueDate !== origDueDate ||
            !arraysEqual(draftCollaboratorIds, origCollaboratorIds) ||
            !arraysEqual(draftTagIds, origTagIds) ||
            !arraysEqual(draftDependencyIds, origDependencyIds))))
  );

  const handleDiscardChanges = () => {
    if (!task) return;
    syncDraftFromTask(task);
    setEditingDesc(false);
  };

  const handleSaveChanges = async (forceBlockedOverride = false) => {
    if (!task || !hasUnsavedChanges) return;

    const patch: Record<string, unknown> = {};
    const isAdminOrManager =
      currentUserRole === "ADMIN" || currentUserRole === "MANAGER";

    if (draftStatus !== task.status) {
      const incompleteSubtasks = task.subtasks.filter(
        (s) => s.status !== "DONE"
      ).length;
      const openBlockers = task.dependencies
        .filter(
          (d) =>
            draftDependencyIds.includes(d.dependsOnId) &&
            d.dependsOn.status !== "DONE"
        )
        .map((d) => ({
          taskKey: d.dependsOn.taskKey,
          title: d.dependsOn.title,
        }));
      const incompleteBlockers = openBlockers.map((b) => b.taskKey);

      const transitionError = validateTaskStatusTransition({
        currentStatus: task.status,
        nextStatus: draftStatus,
        isSubtask: Boolean(task.parentId),
        totalSubtasks: task.subtasks.length,
        incompleteSubtasks,
        canMarkComplete,
        hasAssignee: Boolean(draftAssigneeId),
        incompleteBlockers:
          isAdminOrManager && forceBlockedOverride ? [] : incompleteBlockers,
      });
      if (transitionError) {
        // For Admin/Manager moving a blocked task to In Review/Done, prompt confirmation instead of silent block
        if (
          isAdminOrManager &&
          !forceBlockedOverride &&
          openBlockers.length > 0 &&
          (draftStatus === "IN_REVIEW" || draftStatus === "DONE")
        ) {
          setBlockedSaveWarning(openBlockers);
          return;
        }
        toast.error(transitionError);
        return;
      }

      // Prompt confirmation warning whenever moving a blocked task out of To Do
      if (
        !forceBlockedOverride &&
        openBlockers.length > 0 &&
        draftStatus !== "TODO"
      ) {
        setBlockedSaveWarning(openBlockers);
        return;
      }

      patch.status = draftStatus;
      if (forceBlockedOverride && isAdminOrManager) {
        patch.forceBlockedOverride = true;
      }
    }

    if (canFullEdit) {
      const trimmedTitle = title.trim();
      if (trimmedTitle.length < 2) {
        toast.error("Title must be at least 2 characters.");
        return;
      }
      if (trimmedTitle.length > 200) {
        toast.error("Title must be 200 characters or fewer.");
        return;
      }
      if (trimmedTitle !== task.title) {
        patch.title = trimmedTitle;
      }
      if ((description || "") !== (task.description || "")) {
        patch.description = description;
      }
      if (draftPriority !== task.priority) {
        patch.priority = draftPriority;
      }
      if ((draftAssigneeId || null) !== (task.assigneeId || null)) {
        patch.assigneeId = draftAssigneeId || null;
      }
      if (draftStartDate !== origStartDate) {
        if (draftStartDate && draftStartDate < todayStr) {
          toast.error("Start date cannot be in the past.");
          return;
        }
        patch.startDate = draftStartDate || null;
      }
      if (draftDueDate !== origDueDate) {
        if (draftStartDate && draftDueDate && draftDueDate < draftStartDate) {
          toast.error("Due date cannot be earlier than start date.");
          return;
        }
        patch.dueDate = draftDueDate || null;
      }
      if (!arraysEqual(draftCollaboratorIds, origCollaboratorIds)) {
        patch.collaboratorIds = draftCollaboratorIds.filter(
          (id) => id !== draftAssigneeId
        );
      }
      if (!arraysEqual(draftTagIds, origTagIds)) {
        patch.tagIds = draftTagIds;
      }
      if (!arraysEqual(draftDependencyIds, origDependencyIds)) {
        patch.dependencyIds = draftDependencyIds;
      }
    }

    if (Object.keys(patch).length === 0) return;

    setSaving(true);
    const res = await updateTaskAction({ id: task.id, ...patch });
    setSaving(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setEditingDesc(false);
    toast.success("Changes saved");
    await loadTask(task.id, { silent: true });
    needsBoardRefreshRef.current = true;
  };

  const handleSubtaskStatusToggle = async (
    subtaskId: string,
    currentStatus: TaskStatus
  ) => {
    const nextStatus: TaskStatus =
      currentStatus === "TODO"
        ? "IN_PROGRESS"
        : currentStatus === "DONE"
        ? "TODO"
        : "DONE";
    const res = await updateTaskAction({ id: subtaskId, status: nextStatus });
    if (res.error) {
      toast.error(res.error);
      return;
    }
    if (currentStatus === "TODO") {
      toast.success("Subtask started (In Progress)");
    }
    if (task) await loadTask(task.id, { silent: true, preserveDraft: true });
    needsBoardRefreshRef.current = true;
  };

  const handleSubtaskStatusChange = async (
    subtaskId: string,
    nextStatus: TaskStatus
  ) => {
    const sub = task?.subtasks.find((s) => s.id === subtaskId);
    if (sub) {
      const transitionError = validateTaskStatusTransition({
        currentStatus: sub.status,
        nextStatus,
        isSubtask: true,
        totalSubtasks: 0,
        incompleteSubtasks: 0,
        canMarkComplete: true,
        hasAssignee: Boolean(sub.assignee),
      });
      if (transitionError) {
        toast.error(transitionError);
        return;
      }
    }
    const res = await updateTaskAction({ id: subtaskId, status: nextStatus });
    if (res.error) {
      toast.error(res.error);
      return;
    }
    if (task) await loadTask(task.id, { silent: true, preserveDraft: true });
    needsBoardRefreshRef.current = true;
  };

  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task) return;
    const trimmedTitle = subTitle.trim();
    if (trimmedTitle.length < 2) {
      toast.error("Subtask title must be at least 2 characters.");
      return;
    }
    if (trimmedTitle.length > 200) {
      toast.error("Subtask title must be 200 characters or fewer.");
      return;
    }
    if (!subAssigneeId) {
      toast.error("Please select an assignee for this subtask.");
      return;
    }
    setAddingSubtask(true);
    const res = await createTaskAction({
      title: trimmedTitle,
      projectId: task.projectId,
      parentId: task.id,
      status: "TODO",
      priority: subPriority,
      assigneeId: subAssigneeId,
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
    await loadTask(task.id, { silent: true, preserveDraft: true });
    needsBoardRefreshRef.current = true;
  };

  const handleDeleteSubtask = async (subId: string) => {
    const res = await deleteTaskAction(subId);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Subtask removed");
    if (task) await loadTask(task.id, { silent: true, preserveDraft: true });
    needsBoardRefreshRef.current = true;
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
    await loadTask(task.id, { silent: true, preserveDraft: true });
    needsBoardRefreshRef.current = true;
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
      if (json.data) {
        setTask((prev) =>
          prev
            ? {
                ...prev,
                attachments: [json.data, ...prev.attachments],
              }
            : prev
        );
      } else {
        await loadTask(task.id, { silent: true, preserveDraft: true });
      }
      needsBoardRefreshRef.current = true;
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
    setTask((prev) =>
      prev
        ? {
            ...prev,
            attachments: prev.attachments.filter((a) => a.id !== attId),
          }
        : prev
    );
    needsBoardRefreshRef.current = true;
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
    setDraftCollaboratorIds((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const toggleDepartmentCollaborators = (deptUserIds: string[]) => {
    setDraftCollaboratorIds((prev) => {
      const allSelected =
        deptUserIds.length > 0 &&
        deptUserIds.every((id) => prev.includes(id));
      return allSelected
        ? prev.filter((id) => !deptUserIds.includes(id))
        : Array.from(new Set([...prev, ...deptUserIds]));
    });
  };

  const collaboratorDepartments = (() => {
    const map = new Map<string, { id: string; name: string; userIds: string[] }>();
    for (const u of users) {
      if (u.id === draftAssigneeId) continue;
      if (u.department?.id && u.department?.name) {
        const entry = map.get(u.department.id);
        if (entry) entry.userIds.push(u.id);
        else
          map.set(u.department.id, {
            id: u.department.id,
            name: u.department.name,
            userIds: [u.id],
          });
      }
    }
    return Array.from(map.values());
  })();

  const toggleTag = (tagId: string) => {
    setDraftTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const toggleDependency = (depId: string) => {
    setDraftDependencyIds((prev) =>
      prev.includes(depId) ? prev.filter((id) => id !== depId) : [...prev, depId]
    );
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
      <Sheet open={open} onOpenChange={handleOpenChange}>
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
                    onClick={() => handleOpenChange(false)}
                    aria-label="Close drawer"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Sticky Unsaved Changes Banner */}
              {canUpdateStatus && hasUnsavedChanges && (
                <div className="flex items-center justify-between gap-3 border-b border-[#DFDCFF] bg-[#F5F4FF] px-6 py-2 shrink-0">
                  <span className="text-xs font-medium text-[#5148C9]">
                    You have unsaved changes
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={saving}
                      className="h-7 px-2.5 text-xs bg-white"
                      onClick={handleDiscardChanges}
                    >
                      Discard
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={saving}
                      className="h-7 px-3 text-xs"
                      onClick={() => handleSaveChanges(false)}
                    >
                      {saving ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      Save Changes
                    </Button>
                  </div>
                </div>
              )}

              {/* Sticky Subsection Navigation Bar (Agile Daily Workflow) */}
              <div className="flex items-center gap-1 border-b border-[#EAECF0] bg-[#FAFBFC] px-6 py-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveSection("details")}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    activeSection === "details"
                      ? "bg-white text-[#20232B] shadow-subtle border border-[#EAECF0]"
                      : "text-[#737987] hover:text-[#20232B] hover:bg-white/60"
                  )}
                >
                  <FileText className="h-3.5 w-3.5" />
                  Details
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSection("comments")}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    activeSection === "comments"
                      ? "bg-white text-[#5148C9] shadow-subtle border border-[#DFDCFF]"
                      : "text-[#737987] hover:text-[#20232B] hover:bg-white/60"
                  )}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Comments
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.2 text-[10.5px] font-semibold",
                      activeSection === "comments"
                        ? "bg-[#F0EFFF] text-[#5148C9]"
                        : "bg-[#EAECF0] text-[#525866]"
                    )}
                  >
                    {task.comments.length}
                  </span>
                </button>
              </div>

              {/* DETAILS SUBSECTION */}
              {activeSection === "details" && (
              <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-5 space-y-6">
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
                      maxLength={200}
                      onChange={(e) => setTitle(e.target.value)}
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
                      value={draftStatus}
                      disabled={!canUpdateStatus}
                      onValueChange={(v) => setDraftStatus(v as TaskStatus)}
                    >
                      <SelectTrigger className="h-8 w-[150px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TODO">To Do</SelectItem>
                        <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                        <SelectItem value="IN_REVIEW">In Review / QA</SelectItem>
                        <SelectItem value="DONE">Done</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Priority */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-[#737987]">Priority</span>
                    <Select
                      value={draftPriority}
                      disabled={!canFullEdit}
                      onValueChange={(v) => setDraftPriority(v as Priority)}
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
                      value={draftAssigneeId || "__unassigned__"}
                      disabled={!canFullEdit}
                      onValueChange={(v) => {
                        const nextAssignee = v === "__unassigned__" ? null : v;
                        setDraftAssigneeId(nextAssignee);
                        if (nextAssignee) {
                          setDraftCollaboratorIds((prev) =>
                            prev.filter((id) => id !== nextAssignee)
                          );
                        }
                      }}
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
                      <Progress
                        value={getDisplayTaskProgress({
                          status: draftStatus,
                          progress: task.progress,
                          subtasks: task.subtasks,
                        })}
                        className="h-2 flex-1"
                      />
                      <span className="text-xs font-semibold text-[#20232B] w-9 text-right">
                        {getDisplayTaskProgress({
                          status: draftStatus,
                          progress: task.progress,
                          subtasks: task.subtasks,
                        })}
                        %
                      </span>
                    </div>
                  </div>

                  {/* Start Date */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 text-xs text-[#737987]">
                      <Calendar className="h-3.5 w-3.5" /> Start
                    </span>
                    <DatePicker
                      minDate={todayStr}
                      disabled={!canFullEdit}
                      value={draftStartDate}
                      placeholder="Set start"
                      align="end"
                      onChange={(val) => {
                        if (val && val < todayStr) {
                          toast.error("Start date cannot be in the past");
                          return;
                        }
                        setDraftStartDate(val);
                        if (val && draftDueDate && draftDueDate < val) {
                          setDraftDueDate("");
                        }
                      }}
                      className="h-8 w-[150px] text-xs"
                    />
                  </div>

                  {/* Due Date */}
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 text-xs",
                        isTaskOverdue(draftDueDate || null, draftStatus)
                          ? "text-[#EF4444] font-medium"
                          : "text-[#737987]"
                      )}
                    >
                      <Calendar className="h-3.5 w-3.5" /> Due
                    </span>
                    <DatePicker
                      minDate={
                        draftStartDate && draftStartDate > todayStr
                          ? draftStartDate
                          : todayStr
                      }
                      disabled={!canFullEdit}
                      value={draftDueDate}
                      placeholder="Set due"
                      align="end"
                      onChange={setDraftDueDate}
                      className="h-8 w-[150px] text-xs"
                    />
                  </div>
                </div>

                {/* Collaborators & Tags */}
                <div className="space-y-3">
                  {/* Collaborators */}
                  <div className="flex flex-wrap items-start gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#737987] w-28 pt-1">
                      <Users className="h-3.5 w-3.5" /> Collaborators
                    </span>
                    <div className="flex-1 space-y-2">
                      {canFullEdit && collaboratorDepartments.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 text-[11px] text-[#737987]">
                            <Building2 className="h-3 w-3" />
                            By dept:
                          </span>
                          {collaboratorDepartments.map((dept) => {
                            const allSelected =
                              dept.userIds.length > 0 &&
                              dept.userIds.every((id) =>
                                draftCollaboratorIds.includes(id)
                              );
                            return (
                              <button
                                key={dept.id}
                                type="button"
                                onClick={() =>
                                  toggleDepartmentCollaborators(dept.userIds)
                                }
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-[5px] border px-2 py-0.5 text-[11px] font-medium transition-colors",
                                  allSelected
                                    ? "border-[#635BDB] bg-[#635BDB] text-white"
                                    : "border-[#D5D9E2] bg-[#F7F8FA] text-[#374151] hover:border-[#635BDB] hover:bg-[#F0EFFF] hover:text-[#5148C9]"
                                )}
                              >
                                {allSelected ? (
                                  <Check className="h-3 w-3" />
                                ) : (
                                  <Plus className="h-3 w-3" />
                                )}
                                All {dept.name} ({dept.userIds.length})
                              </button>
                            );
                          })}
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {users
                          .filter((u) => u.id !== draftAssigneeId)
                          .map((u) => {
                            const active = draftCollaboratorIds.includes(u.id);
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
                        {!canFullEdit && draftCollaboratorIds.length === 0 && (
                          <span className="text-xs text-[#9CA3AF]">None</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#737987] w-28">
                      <Tag className="h-3.5 w-3.5" /> Tags
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5 flex-1">
                      {tags.map((tag) => {
                        const active = draftTagIds.includes(tag.id);
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

                  {/* Dependencies (same project, open tasks & subtasks only, searchable) */}
                  <div className="flex flex-wrap items-start gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#737987] w-28 pt-1">
                      <Link2 className="h-3.5 w-3.5" /> Blocked by
                    </span>
                    <BlockerPicker
                      projectId={task.projectId}
                      excludeTaskId={task.id}
                      excludeParentId={task.parentId}
                      candidates={allProjectTasks}
                      selectedIds={draftDependencyIds}
                      onToggle={toggleDependency}
                      disabled={!canFullEdit}
                      existingDependencies={task.dependencies}
                    />
                  </div>
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
                      <div className="flex items-center justify-between text-[11px] text-[#737987]">
                        <span>Click Save at the top to apply all changes.</span>
                        <button
                          type="button"
                          onClick={() => setEditingDesc(false)}
                          className="font-medium text-[#635BDB] hover:text-[#5148C9]"
                        >
                          Done editing
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => canFullEdit && setEditingDesc(true)}
                      className={cn(
                        "rounded-md border border-[#EAECF0] bg-white p-3.5 text-[13px] leading-relaxed text-[#374151] whitespace-pre-wrap break-words [overflow-wrap:anywhere]",
                        canFullEdit && "cursor-text hover:border-[#D1D5DB]"
                      )}
                    >
                      {description || (
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
                        <Progress
                          value={getDisplayTaskProgress(task)}
                          className="h-1.5 flex-1"
                        />
                        <span className="text-[11px] font-medium text-[#737987]">
                          {getDisplayTaskProgress(task)}% auto-calculated
                        </span>
                      </div>
                    )}

                    {/* Inline Add Subtask Form */}
                    {showSubtaskForm && (
                      <form
                        onSubmit={handleAddSubtask}
                        className="rounded-lg border border-[#635BDB]/30 bg-[#F0EFFF]/30 p-3 space-y-2.5"
                      >
                        <div className="space-y-1">
                          <Input
                            value={subTitle}
                            maxLength={200}
                            onChange={(e) => setSubTitle(e.target.value)}
                            placeholder="Subtask title (e.g., Build hero section)"
                            autoFocus
                          />
                          <div className="flex justify-end text-[10.5px] text-[#737987]">
                            <span
                              className={cn(
                                subTitle.length >= 190 && "text-[#F59E0B] font-medium",
                                subTitle.length >= 200 && "text-[#EF4444] font-medium"
                              )}
                            >
                              {subTitle.length}/200
                            </span>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <Select
                            value={subAssigneeId}
                            onValueChange={setSubAssigneeId}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Assignee *" />
                            </SelectTrigger>
                            <SelectContent>
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

                          <DatePicker
                            minDate={todayStr}
                            value={subDueDate}
                            placeholder="Due date"
                            align="end"
                            onChange={setSubDueDate}
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
                                  isDone
                                    ? "Reopen as To Do"
                                    : sub.status === "TODO"
                                    ? "Start subtask (In Progress)"
                                    : "Mark as Done"
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
                      {task.attachments.map((att) => {
                        const isImage =
                          (att.mimeType || "").toLowerCase().startsWith("image/") &&
                          !(att.mimeType || "").toLowerCase().includes("svg");
                        return (
                          <div
                            key={att.id}
                            className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-[#F7F8FA]/80 transition-colors"
                          >
                            <button
                              type="button"
                              onClick={() => openAttachmentPreview(att)}
                              className="flex items-center gap-2.5 min-w-0 flex-1 text-left group"
                            >
                              {isImage ? (
                                <img
                                  src={`${att.fileUrl}?preview=1`}
                                  alt={att.fileName}
                                  className="h-9 w-9 shrink-0 rounded border border-[#EAECF0] object-cover bg-[#F7F8FA]"
                                />
                              ) : (
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-[#EAECF0] bg-[#F7F8FA] text-[#737987]">
                                  <Paperclip className="h-4 w-4" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="truncate text-xs font-medium text-[#20232B] group-hover:text-[#635BDB] transition-colors">
                                  {att.fileName}
                                </p>
                                <p className="text-[11px] text-[#9CA3AF]">
                                  {formatFileSize(att.fileSize)} · Uploaded by{" "}
                                  {att.uploadedBy.name} ·{" "}
                                  {formatRelativeTime(att.createdAt)}
                                </p>
                              </div>
                            </button>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => openAttachmentPreview(att)}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#737987] hover:bg-[#F0EFFF] hover:text-[#635BDB]"
                                title="Preview"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                              <a
                                href={att.fileUrl}
                                download
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#737987] hover:bg-[#F3F4F6] hover:text-[#20232B]"
                                title="Download"
                              >
                                <Download className="h-3.5 w-3.5" />
                              </a>
                              {canDeleteAttachment && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteAttachment(att.id)}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#737987] hover:bg-red-50 hover:text-red-600"
                                  title="Delete file"
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
              </div>
              )}

              {/* COMMENTS SUBSECTION (Pinned Agile Composer + Scrollable Thread) */}
              {activeSection === "comments" && (
                <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
                  {/* Scrollable Comments Thread */}
                  <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-4 space-y-3">
                    {task.comments.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-14 text-center">
                        <MessageSquare className="h-7 w-7 text-[#CBD5E1] mb-2" />
                        <p className="text-sm font-medium text-[#20232B]">
                          No comments yet
                        </p>
                        <p className="mt-1 text-xs text-[#737987] max-w-xs">
                          Drop a quick standup update, QA note, or @mention a
                          teammate below.
                        </p>
                      </div>
                    ) : (
                      task.comments.map((c) => (
                        <div key={c.id} className="flex gap-2.5 min-w-0">
                          <UserAvatar
                            name={c.author.name}
                            avatarUrl={c.author.avatarUrl}
                            size="sm"
                            className="mt-0.5 shrink-0"
                          />
                          <div className="flex-1 min-w-0 overflow-hidden rounded-lg border border-[#EAECF0] bg-[#F7F8FA]/80 px-3.5 py-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate text-xs font-semibold text-[#20232B]">
                                {c.author.name}
                              </span>
                              <span className="shrink-0 text-[11px] text-[#9CA3AF]">
                                {formatRelativeTime(c.createdAt)}
                              </span>
                            </div>
                            <p className="mt-1 text-[13px] leading-relaxed text-[#374151] whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                              {renderCommentText(c.content)}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Sticky Agile Comment Composer */}
                  <div className="border-t border-[#EAECF0] bg-white px-6 py-3.5 shrink-0 space-y-2.5">
                    {/* 1-Click Agile Quick Updates */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {[
                        "Started working on this",
                        "Ready for QA review",
                        "Found a bug — needs fix",
                        "Blocked — need help",
                      ].map((snippet) => (
                        <button
                          key={snippet}
                          type="button"
                          onClick={() =>
                            setCommentText((prev) =>
                              prev ? `${prev} ${snippet}` : snippet
                            )
                          }
                          className="rounded-full border border-[#E2E6EE] bg-[#F7F8FA] px-2.5 py-0.5 text-[11px] font-medium text-[#525866] hover:border-[#635BDB]/50 hover:bg-[#F0EFFF] hover:text-[#5148C9] transition-colors"
                        >
                          + {snippet}
                        </button>
                      ))}
                    </div>

                    <form onSubmit={handleAddComment} className="space-y-2">
                      <div className="relative">
                        <Textarea
                          rows={2}
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          onKeyDown={(e) => {
                            if (
                              (e.metaKey || e.ctrlKey) &&
                              e.key === "Enter" &&
                              commentText.trim() &&
                              !postingComment
                            ) {
                              e.preventDefault();
                              handleAddComment(e);
                            }
                          }}
                          placeholder="Write an update or @mention a colleague... (Ctrl+Enter to post)"
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
                  </div>
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Blocked Ticket Save Confirmation Warning Dialog */}
      <Dialog
        open={!!blockedSaveWarning}
        onOpenChange={(o) => {
          if (!o) setBlockedSaveWarning(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-amber-800">
              Task Has Unfinished Blockers
            </DialogTitle>
            <DialogDescription>
              <strong className="text-[#20232B]">{task?.taskKey}</strong> is
              still blocked by unfinished prerequisite task(s). Are you sure you
              want to change its status anyway?
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-amber-200 bg-amber-50/80 p-3 space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-800">
              Blocking Tasks
            </p>
            {blockedSaveWarning?.map((b) => (
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
              onClick={() => setBlockedSaveWarning(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={async () => {
                setBlockedSaveWarning(null);
                await handleSaveChanges(true);
              }}
            >
              Confirm &amp; Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Attachment Preview Modal */}
      <Dialog
        open={!!previewAttachment}
        onOpenChange={(open) => !open && setPreviewAttachment(null)}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="truncate pr-8">
              {previewAttachment?.fileName}
            </DialogTitle>
            <DialogDescription>
              {previewAttachment
                ? `${formatFileSize(previewAttachment.fileSize)} · Uploaded by ${previewAttachment.uploadedBy.name}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {previewAttachment && (
            <div className="flex-1 min-h-[260px] overflow-auto rounded-lg border border-[#EAECF0] bg-[#F7F8FA] flex items-center justify-center p-3">
              {(previewAttachment.mimeType || "")
                .toLowerCase()
                .startsWith("image/") &&
              !(previewAttachment.mimeType || "")
                .toLowerCase()
                .includes("svg") ? (
                <img
                  src={`${previewAttachment.fileUrl}?preview=1`}
                  alt={previewAttachment.fileName}
                  className="max-h-[68vh] max-w-full rounded object-contain shadow-subtle"
                />
              ) : (previewAttachment.mimeType || "").toLowerCase() ===
                "application/pdf" ? (
                <iframe
                  src={`${previewAttachment.fileUrl}?preview=1`}
                  title={previewAttachment.fileName}
                  className="h-[68vh] w-full rounded bg-white"
                />
              ) : (previewAttachment.mimeType || "")
                  .toLowerCase()
                  .startsWith("video/") ? (
                <video
                  src={`${previewAttachment.fileUrl}?preview=1`}
                  controls
                  className="max-h-[68vh] max-w-full rounded"
                />
              ) : (previewAttachment.mimeType || "")
                  .toLowerCase()
                  .startsWith("audio/") ? (
                <audio
                  src={`${previewAttachment.fileUrl}?preview=1`}
                  controls
                  className="w-full max-w-md"
                />
              ) : loadingPreviewText ? (
                <Loader2 className="h-5 w-5 animate-spin text-[#635BDB]" />
              ) : previewTextContent !== null ? (
                <pre className="w-full max-h-[65vh] overflow-auto rounded bg-white p-4 text-xs font-mono text-[#20232B] whitespace-pre-wrap">
                  {previewTextContent}
                </pre>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                  <FileText className="h-10 w-10 text-[#9CA3AF]" />
                  <p className="text-sm font-medium text-[#20232B]">
                    Inline preview not available for this file type
                  </p>
                  <p className="text-xs text-[#737987]">
                    Download the file to open it on your device.
                  </p>
                </div>
              )}
            </div>
          )}

          {previewAttachment && (
            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" asChild>
                <a
                  href={`${previewAttachment.fileUrl}?preview=1`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open in New Tab
                </a>
              </Button>
              <Button asChild>
                <a href={previewAttachment.fileUrl} download>
                  <Download className="h-3.5 w-3.5" />
                  Download
                </a>
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

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
