"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, Check, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { taskCreateSchema } from "@/lib/validations";
import { createTaskAction } from "@/actions/tasks";
import { getServerTodayStr } from "@/lib/utils";
import type {
  ProjectSummary,
  TagSummary,
  TaskListItem,
  UserSummary,
} from "@/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import {
  BlockerPicker,
  type BlockerCandidate,
} from "@/components/tasks/blocker-picker";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Priority, TaskStatus } from "@prisma/client";

type TaskCreateForm = z.input<typeof taskCreateSchema>;

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: ProjectSummary[];
  users: UserSummary[];
  tags: TagSummary[];
  defaultProjectId?: string;
  defaultStatus?: TaskStatus;
  parentId?: string | null;
  parentTitle?: string | null;
  availableDependencies?: BlockerCandidate[];
  onCreated?: (newTask?: TaskListItem) => void;
}

export function CreateTaskDialog({
  open,
  onOpenChange,
  projects,
  users,
  tags,
  defaultProjectId,
  defaultStatus = "TODO",
  parentId = null,
  parentTitle = null,
  availableDependencies = [],
  onCreated,
}: CreateTaskDialogProps) {
  const router = useRouter();
  const [selectedCollaborators, setSelectedCollaborators] = useState<string[]>([]);
  const [collabDeptFilter, setCollabDeptFilter] = useState<string>("ALL");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedDeps, setSelectedDeps] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TaskCreateForm>({
    resolver: zodResolver(taskCreateSchema),
    defaultValues: {
      title: "",
      description: "",
      projectId: defaultProjectId || projects[0]?.id || "",
      parentId: parentId || null,
      status: defaultStatus,
      priority: "MEDIUM",
      assigneeId: "",
      collaboratorIds: [],
      tagIds: [],
      dependencyIds: [],
      startDate: "",
      dueDate: "",
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        title: "",
        description: "",
        projectId: defaultProjectId || projects[0]?.id || "",
        parentId: parentId || null,
        status: defaultStatus,
        priority: "MEDIUM",
        assigneeId: "",
        collaboratorIds: [],
        tagIds: [],
        dependencyIds: [],
        startDate: "",
        dueDate: "",
      });
      setSelectedCollaborators([]);
      setCollabDeptFilter("ALL");
      setSelectedTags([]);
      setSelectedDeps([]);
    }
  }, [open, defaultProjectId, defaultStatus, parentId, projects, reset]);

  const projectId = watch("projectId");
  const status = watch("status");
  const priority = watch("priority");
  const assigneeId = watch("assigneeId");
  const startDate = watch("startDate");
  const dueDate = watch("dueDate");
  const todayStr = getServerTodayStr();
  const minDueDate =
    startDate && startDate > todayStr ? startDate : todayStr;

  const collaboratorCandidates = useMemo(
    () => users.filter((u) => u.id !== assigneeId),
    [users, assigneeId]
  );

  const departmentGroups = useMemo(() => {
    const map = new Map<string, { id: string; name: string; userIds: string[] }>();
    for (const u of collaboratorCandidates) {
      if (u.department?.id && u.department?.name) {
        const existing = map.get(u.department.id);
        if (existing) {
          existing.userIds.push(u.id);
        } else {
          map.set(u.department.id, {
            id: u.department.id,
            name: u.department.name,
            userIds: [u.id],
          });
        }
      }
    }
    return Array.from(map.values());
  }, [collaboratorCandidates]);

  const visibleCollaborators = useMemo(() => {
    if (collabDeptFilter === "ALL") return collaboratorCandidates;
    if (collabDeptFilter === "UNASSIGNED") {
      return collaboratorCandidates.filter((u) => !u.department?.id);
    }
    return collaboratorCandidates.filter(
      (u) => u.department?.id === collabDeptFilter
    );
  }, [collaboratorCandidates, collabDeptFilter]);

  const toggleDepartmentCollaborators = (deptUserIds: string[]) => {
    const allSelected =
      deptUserIds.length > 0 &&
      deptUserIds.every((id) => selectedCollaborators.includes(id));

    if (allSelected) {
      setSelectedCollaborators((prev) =>
        prev.filter((id) => !deptUserIds.includes(id))
      );
    } else {
      setSelectedCollaborators((prev) =>
        Array.from(new Set([...prev, ...deptUserIds]))
      );
    }
  };

  const toggleItem = (
    id: string,
    list: string[],
    setter: (v: string[]) => void
  ) => {
    if (list.includes(id)) {
      setter(list.filter((item) => item !== id));
    } else {
      setter([...list, id]);
    }
  };

  const onSubmit = async (values: TaskCreateForm) => {
    const result = await createTaskAction({
      ...values,
      assigneeId: values.assigneeId,
      startDate: values.startDate || null,
      dueDate: values.dueDate || null,
      parentId: parentId || null,
      collaboratorIds: selectedCollaborators,
      tagIds: selectedTags,
      dependencyIds: selectedDeps,
    });

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(
      parentId
        ? `Subtask ${result.taskKey} added`
        : `Task ${result.taskKey} created`
    );
    onOpenChange(false);
    onCreated?.(result.task);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {parentId ? "Create Subtask" : "Create New Task"}
          </DialogTitle>
          <DialogDescription>
            {parentId && parentTitle
              ? `Adding a subtask under "${parentTitle}"`
              : "Assign ownership, priority, dates, and collaborators."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              maxLength={200}
              placeholder={
                parentId
                  ? "e.g., Implement responsive navigation bar"
                  : "e.g., Develop Homepage"
              }
              {...register("title")}
            />
            {errors.title && (
              <p className="text-[11px] text-red-600">{errors.title.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-desc">Description</Label>
            <Textarea
              id="task-desc"
              rows={3}
              placeholder="Outline requirements, deliverables, and acceptance criteria..."
              {...register("description")}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {!parentId && (
              <div className="space-y-1.5">
                <Label>Project</Label>
                <Select
                  value={projectId}
                  onValueChange={(v) => setValue("projectId", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        <span className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: p.color }}
                          />
                          {p.name} ({p.code})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.projectId && (
                  <p className="text-[11px] text-red-600">
                    {errors.projectId.message}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label>
                Assignee <span className="text-red-500">*</span>
              </Label>
              <Select
                value={assigneeId || ""}
                onValueChange={(v) =>
                  setValue("assigneeId", v, { shouldValidate: true })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select assignee" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.assigneeId && (
                <p className="text-[11px] text-red-600">
                  {errors.assigneeId.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setValue("status", v as TaskStatus)}
              >
                <SelectTrigger>
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

            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select
                value={priority}
                onValueChange={(v) => setValue("priority", v as Priority)}
              >
                <SelectTrigger>
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

            <div className="space-y-1.5">
              <Label htmlFor="task-start">Start Date</Label>
              <DatePicker
                id="task-start"
                value={startDate}
                minDate={todayStr}
                placeholder="Select start date"
                onChange={(val) => {
                  setValue("startDate", val, { shouldValidate: true });
                  if (val && dueDate && dueDate < val) {
                    setValue("dueDate", "", { shouldValidate: true });
                  }
                }}
              />
              {errors.startDate && (
                <p className="text-[11px] text-red-600">
                  {errors.startDate.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="task-due">Due Date</Label>
              <DatePicker
                id="task-due"
                value={dueDate}
                minDate={minDueDate}
                placeholder="Select due date"
                onChange={(val) =>
                  setValue("dueDate", val, { shouldValidate: true })
                }
              />
              {errors.dueDate && (
                <p className="text-[11px] text-red-600">
                  {errors.dueDate.message}
                </p>
              )}
            </div>
          </div>

          {!parentId && users.length > 0 && (
            <div className="space-y-2 rounded-lg border border-[#EAECF0] bg-[#F7F8FA] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="text-xs font-semibold text-[#20232B]">
                  Collaborators ({selectedCollaborators.length} selected)
                </Label>
                <div className="flex items-center gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedCollaborators((prev) =>
                        Array.from(
                          new Set([
                            ...prev,
                            ...visibleCollaborators.map((u) => u.id),
                          ])
                        )
                      )
                    }
                    className="font-medium text-[#635BDB] hover:text-[#5148C9]"
                  >
                    Select all shown ({visibleCollaborators.length})
                  </button>
                  {selectedCollaborators.length > 0 && (
                    <>
                      <span className="text-[#D1D5DB]">·</span>
                      <button
                        type="button"
                        onClick={() => setSelectedCollaborators([])}
                        className="text-[#737987] hover:text-[#20232B]"
                      >
                        Clear all
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Filter & One-Click Select All by Department */}
              {departmentGroups.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#737987]">
                      <Building2 className="h-3 w-3" />
                      Select all by department:
                    </span>
                    <Select
                      value={collabDeptFilter}
                      onValueChange={setCollabDeptFilter}
                    >
                      <SelectTrigger className="h-7 w-[155px] text-xs bg-white">
                        <SelectValue placeholder="Filter department" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All Departments</SelectItem>
                        {departmentGroups.map((dept) => (
                          <SelectItem key={dept.id} value={dept.id}>
                            {dept.name} ({dept.userIds.length})
                          </SelectItem>
                        ))}
                        <SelectItem value="UNASSIGNED">
                          No Department
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {departmentGroups.map((dept) => {
                      const allDeptSelected =
                        dept.userIds.length > 0 &&
                        dept.userIds.every((id) =>
                          selectedCollaborators.includes(id)
                        );
                      return (
                        <button
                          key={dept.id}
                          type="button"
                          onClick={() =>
                            toggleDepartmentCollaborators(dept.userIds)
                          }
                          className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
                            allDeptSelected
                              ? "border-[#635BDB] bg-[#635BDB] text-white"
                              : "border-[#D5D9E2] bg-white text-[#374151] hover:border-[#635BDB] hover:bg-[#F0EFFF] hover:text-[#5148C9]"
                          }`}
                        >
                          {allDeptSelected ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <Plus className="h-3 w-3" />
                          )}
                          All {dept.name} ({dept.userIds.length})
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Collaborators List */}
              <div className="flex flex-wrap gap-1.5 rounded-md border border-[#EAECF0] bg-white p-2 max-h-28 overflow-y-auto">
                {visibleCollaborators.length === 0 ? (
                  <p className="w-full py-2 text-center text-xs text-[#737987]">
                    No members available in this department.
                  </p>
                ) : (
                  visibleCollaborators.map((u) => {
                    const active = selectedCollaborators.includes(u.id);
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() =>
                          toggleItem(
                            u.id,
                            selectedCollaborators,
                            setSelectedCollaborators
                          )
                        }
                        className={`inline-flex items-center gap-1.5 rounded-[5px] border px-2 py-1 text-[11px] font-medium transition-colors ${
                          active
                            ? "border-[#635BDB] bg-[#F0EFFF] text-[#5148C9]"
                            : "border-[#EAECF0] bg-[#F7F8FA] text-[#4B5563] hover:border-[#D1D5DB]"
                        }`}
                      >
                        <span>{u.name}</span>
                        {u.department?.name && (
                          <span className="rounded bg-white/80 px-1 text-[10px] text-[#737987]">
                            {u.department.name}
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {!parentId && tags.length > 0 && (
            <div className="space-y-1.5">
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => {
                  const active = selectedTags.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() =>
                        toggleItem(tag.id, selectedTags, setSelectedTags)
                      }
                      className={`inline-flex items-center gap-1.5 rounded-[5px] border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                        active
                          ? "border-[#635BDB] bg-[#F0EFFF] text-[#5148C9]"
                          : "border-[#EAECF0] bg-white text-[#4B5563] hover:bg-[#F7F8FA]"
                      }`}
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
          )}

          {projectId && availableDependencies.length > 0 && (
            <div className="space-y-1.5">
              <Label>Blocked By (Dependencies)</Label>
              <div className="rounded-md border border-[#EAECF0] bg-[#F7F8FA] p-2">
                <BlockerPicker
                  projectId={projectId}
                  excludeParentId={parentId}
                  candidates={availableDependencies}
                  selectedIds={selectedDeps}
                  onToggle={(id) => toggleItem(id, selectedDeps, setSelectedDeps)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              {parentId ? "Add Subtask" : "Create Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
