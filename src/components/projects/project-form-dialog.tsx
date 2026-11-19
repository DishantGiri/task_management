"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import type { Priority, ProjectStatus, Role } from "@prisma/client";
import type { ProjectListItem, UserSummary } from "@/types";
import { projectCreateSchema } from "@/lib/validations";
import { createProjectAction, updateProjectAction } from "@/actions/projects";
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

type ProjectFormValues = z.input<typeof projectCreateSchema>;

const COLOR_SWATCHES = [
  "#635BDB",
  "#0EA5E9",
  "#16A34A",
  "#F59E0B",
  "#EF4444",
  "#EC4899",
  "#0D9488",
  "#475569",
];

export function ProjectFormDialog({
  open,
  onOpenChange,
  users,
  currentUserId,
  currentUserRole,
  editingProject,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: UserSummary[];
  currentUserId: string;
  currentUserRole: Role;
  editingProject?: ProjectListItem | null;
}) {
  const router = useRouter();
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  const managerCandidates = users.filter(
    (u) => u.role === "ADMIN" || u.role === "MANAGER"
  );

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectCreateSchema),
    defaultValues: {
      name: "",
      code: "",
      description: "",
      color: "#635BDB",
      status: "ACTIVE",
      priority: "MEDIUM",
      managerId: currentUserId,
      startDate: "",
      endDate: "",
      memberIds: [],
    },
  });

  useEffect(() => {
    if (!open) return;
    if (editingProject) {
      reset({
        name: editingProject.name,
        code: editingProject.code,
        description: editingProject.description || "",
        color: editingProject.color,
        status: editingProject.status,
        priority: editingProject.priority,
        managerId: editingProject.managerId,
        startDate: editingProject.startDate
          ? editingProject.startDate.slice(0, 10)
          : "",
        endDate: editingProject.endDate
          ? editingProject.endDate.slice(0, 10)
          : "",
        memberIds: editingProject.members.map((m) => m.user.id),
      });
      setSelectedMembers(editingProject.members.map((m) => m.user.id));
    } else {
      reset({
        name: "",
        code: "",
        description: "",
        color: "#635BDB",
        status: "ACTIVE",
        priority: "MEDIUM",
        managerId: currentUserId,
        startDate: "",
        endDate: "",
        memberIds: [currentUserId],
      });
      setSelectedMembers([currentUserId]);
    }
  }, [open, editingProject, currentUserId, reset]);

  const color = watch("color");
  const status = watch("status");
  const priority = watch("priority");
  const managerId = watch("managerId");

  const toggleMember = (uid: string) => {
    setSelectedMembers((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const onSubmit = async (values: ProjectFormValues) => {
    const payload = {
      ...values,
      startDate: values.startDate || null,
      endDate: values.endDate || null,
      memberIds: selectedMembers,
    };

    const res = editingProject
      ? await updateProjectAction({ ...payload, id: editingProject.id })
      : await createProjectAction(payload);

    if (res.error) {
      toast.error(res.error);
      return;
    }

    toast.success(editingProject ? "Project updated" : "Project created");
    onOpenChange(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingProject ? "Edit Project" : "Create Project"}
          </DialogTitle>
          <DialogDescription>
            Configure project workspace details, ownership, timeline, and team.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="proj-name">Project Name</Label>
              <Input
                id="proj-name"
                placeholder="e.g., Company Website"
                {...register("name")}
              />
              {errors.name && (
                <p className="text-[11px] text-red-600">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="proj-code">Key Code</Label>
              <Input
                id="proj-code"
                placeholder="WEB"
                maxLength={8}
                className="uppercase font-mono"
                {...register("code")}
              />
              {errors.code && (
                <p className="text-[11px] text-red-600">{errors.code.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="proj-desc">Description</Label>
            <Textarea
              id="proj-desc"
              rows={3}
              placeholder="Project scope, objectives, and key deliverables..."
              {...register("description")}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Accent Color</Label>
            <div className="flex items-center gap-2">
              {COLOR_SWATCHES.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  onClick={() => setValue("color", swatch)}
                  style={{ backgroundColor: swatch }}
                  className={`h-6 w-6 rounded-md transition-transform ${
                    color === swatch
                      ? "ring-2 ring-offset-2 ring-[#20232B] scale-105"
                      : "hover:scale-105"
                  }`}
                  aria-label={`Select color ${swatch}`}
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setValue("status", v as ProjectStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PLANNING">Planning</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="ON_HOLD">On Hold</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="ARCHIVED">Archived</SelectItem>
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
              <Label>Project Manager</Label>
              <Select
                value={managerId}
                disabled={currentUserRole !== "ADMIN"}
                onValueChange={(v) => setValue("managerId", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {managerCandidates.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="proj-start">Start Date</Label>
              <Input id="proj-start" type="date" {...register("startDate")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="proj-end">Target End Date</Label>
              <Input id="proj-end" type="date" {...register("endDate")} />
            </div>
          </div>

          {!editingProject && (
            <div className="space-y-1.5">
              <Label>Team Members</Label>
              <div className="flex flex-wrap gap-1.5 rounded-md border border-[#EAECF0] bg-[#F7F8FA] p-2.5 max-h-28 overflow-y-auto">
                {users.map((u) => {
                  const active = selectedMembers.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => toggleMember(u.id)}
                      className={`rounded-[5px] border px-2 py-1 text-xs font-medium transition-colors ${
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

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {editingProject ? "Save Changes" : "Create Project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
