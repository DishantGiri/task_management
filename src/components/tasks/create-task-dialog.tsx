"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { taskCreateSchema } from "@/lib/validations";
import { createTaskAction } from "@/actions/tasks";
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
  availableDependencies?: { id: string; taskKey: string; title: string }[];
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
      setSelectedTags([]);
      setSelectedDeps([]);
    }
  }, [open, defaultProjectId, defaultStatus, parentId, projects, reset]);

  const projectId = watch("projectId");
  const status = watch("status");
  const priority = watch("priority");
  const assigneeId = watch("assigneeId");

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
      assigneeId: values.assigneeId || null,
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
              <Label>Assignee</Label>
              <Select
                value={assigneeId || "__unassigned__"}
                onValueChange={(v) =>
                  setValue("assigneeId", v === "__unassigned__" ? "" : v)
                }
              >
                <SelectTrigger>
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
              <Input id="task-start" type="date" {...register("startDate")} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="task-due">Due Date</Label>
              <Input id="task-due" type="date" {...register("dueDate")} />
            </div>
          </div>

          {!parentId && users.length > 0 && (
            <div className="space-y-1.5">
              <Label>Collaborators</Label>
              <div className="flex flex-wrap gap-1.5 rounded-md border border-[#EAECF0] bg-[#F7F8FA] p-2 max-h-24 overflow-y-auto">
                {users
                  .filter((u) => u.id !== assigneeId)
                  .map((u) => {
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
                        className={`rounded-[5px] border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                          active
                            ? "border-[#635BDB] bg-[#F0EFFF] text-[#5148C9]"
                            : "border-[#EAECF0] bg-white text-[#4B5563] hover:border-[#D1D5DB]"
                        }`}
                      >
                        {u.name}
                      </button>
                    );
                  })}
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

          {!parentId && availableDependencies.length > 0 && (
            <div className="space-y-1.5">
              <Label>Blocked By (Dependencies)</Label>
              <div className="flex flex-wrap gap-1.5 rounded-md border border-[#EAECF0] bg-[#F7F8FA] p-2 max-h-24 overflow-y-auto">
                {availableDependencies.map((dep) => {
                  const active = selectedDeps.includes(dep.id);
                  return (
                    <button
                      key={dep.id}
                      type="button"
                      onClick={() =>
                        toggleItem(dep.id, selectedDeps, setSelectedDeps)
                      }
                      className={`rounded-[5px] border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                        active
                          ? "border-[#635BDB] bg-[#F0EFFF] text-[#5148C9]"
                          : "border-[#EAECF0] bg-white text-[#4B5563] hover:border-[#D1D5DB]"
                      }`}
                    >
                      {dep.taskKey}: {dep.title.slice(0, 28)}
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
