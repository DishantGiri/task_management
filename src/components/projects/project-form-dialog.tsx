"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, Check, Loader2, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import type { Priority, ProjectStatus, Role } from "@prisma/client";
import type { ProjectListItem, UserSummary } from "@/types";
import { projectCreateSchema } from "@/lib/validations";
import { createProjectAction, updateProjectAction } from "@/actions/projects";
import { cn, getServerTodayStr } from "@/lib/utils";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { UserAvatar } from "@/components/ui/avatar";
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
  departments = [],
  currentUserId,
  currentUserRole,
  editingProject,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: UserSummary[];
  departments?: { id: string; name: string }[];
  currentUserId: string;
  currentUserRole: Role;
  editingProject?: ProjectListItem | null;
}) {
  const router = useRouter();
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberDeptFilter, setMemberDeptFilter] = useState("ALL");

  const managerCandidates = users.filter(
    (u) => u.role === "ADMIN" || u.role === "MANAGER"
  );

  // Derive distinct departments from prop + users so filter always shows all available departments
  const departmentOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of departments) {
      map.set(d.id, d.name);
    }
    for (const u of users) {
      if (u.department?.id && u.department?.name) {
        map.set(u.department.id, u.department.name);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [departments, users]);

  const filteredMemberCandidates = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    return users.filter((u) => {
      if (
        memberDeptFilter === "UNASSIGNED" &&
        u.department?.id
      ) {
        return false;
      }
      if (
        memberDeptFilter !== "ALL" &&
        memberDeptFilter !== "UNASSIGNED" &&
        u.department?.id !== memberDeptFilter
      ) {
        return false;
      }
      if (q) {
        const match =
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.designation || "").toLowerCase().includes(q) ||
          (u.department?.name || "").toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [users, memberSearch, memberDeptFilter]);

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
    setMemberSearch("");
    setMemberDeptFilter("ALL");
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
  const startDateVal = watch("startDate");
  const endDateVal = watch("endDate");
  const todayStr = getServerTodayStr();
  const minEndDate =
    startDateVal && startDateVal > todayStr ? startDateVal : todayStr;

  const toggleMember = (uid: string) => {
    setSelectedMembers((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const selectAllFiltered = () => {
    const idsToAdd = filteredMemberCandidates.map((u) => u.id);
    setSelectedMembers((prev) => Array.from(new Set([...prev, ...idsToAdd])));
  };

  const clearFiltered = () => {
    const filteredIds = new Set(filteredMemberCandidates.map((u) => u.id));
    setSelectedMembers((prev) =>
      prev.filter((id) => !filteredIds.has(id) || id === managerId)
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
            Configure project workspace details, ownership, timeline, and team members.
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
              rows={2}
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
              <DatePicker
                id="proj-start"
                value={startDateVal}
                minDate={todayStr}
                placeholder="Select start date"
                onChange={(val) => {
                  setValue("startDate", val, { shouldValidate: true });
                  if (val && endDateVal && endDateVal < val) {
                    setValue("endDate", "", { shouldValidate: true });
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
              <Label htmlFor="proj-end">Target End Date</Label>
              <DatePicker
                id="proj-end"
                value={endDateVal}
                minDate={minEndDate}
                placeholder="Select end date"
                onChange={(val) =>
                  setValue("endDate", val, { shouldValidate: true })
                }
              />
              {errors.endDate && (
                <p className="text-[11px] text-red-600">
                  {errors.endDate.message}
                </p>
              )}
            </div>
          </div>

          {/* Team Members Selector with Department Filter & Search */}
          <div className="space-y-2 rounded-lg border border-[#EAECF0] bg-[#F7F8FA] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-[#635BDB]" />
                <Label className="text-xs font-semibold text-[#20232B]">
                  Team Members ({selectedMembers.length} selected)
                </Label>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={selectAllFiltered}
                  className="font-medium text-[#635BDB] hover:text-[#5148C9]"
                >
                  Select all shown ({filteredMemberCandidates.length})
                </button>
                <span className="text-[#D1D5DB]">·</span>
                <button
                  type="button"
                  onClick={clearFiltered}
                  className="text-[#737987] hover:text-[#20232B]"
                >
                  Deselect shown
                </button>
              </div>
            </div>

            {/* Search & Department Filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9CA3AF]" />
                <input
                  type="text"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="Search members by name, email..."
                  className="h-8 w-full rounded-md border border-[#E2E6EE] bg-white pl-8 pr-3 text-xs text-[#20232B] placeholder:text-[#9CA3AF] focus:border-[#635BDB] focus:outline-none"
                />
              </div>

              <Select
                value={memberDeptFilter}
                onValueChange={setMemberDeptFilter}
              >
                <SelectTrigger className="h-8 text-xs bg-white">
                  <Building2 className="h-3.5 w-3.5 mr-1 text-[#737987]" />
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Departments</SelectItem>
                  {departmentOptions.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="UNASSIGNED">No Department</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filtered Member List */}
            <div className="max-h-44 overflow-y-auto divide-y divide-[#EAECF0] rounded-md border border-[#EAECF0] bg-white">
              {filteredMemberCandidates.length === 0 ? (
                <p className="py-6 text-center text-xs text-[#737987]">
                  No employees match this department or search query.
                </p>
              ) : (
                filteredMemberCandidates.map((u) => {
                  const active = selectedMembers.includes(u.id);
                  const isManager = u.id === managerId;
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => toggleMember(u.id)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2.5 px-3 py-2 text-left transition-colors hover:bg-[#F7F8FA]",
                        active && "bg-[#F0EFFF]/45"
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={cn(
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
                            active
                              ? "border-[#635BDB] bg-[#635BDB] text-white"
                              : "border-[#D1D5DB] bg-white"
                          )}
                        >
                          {active && <Check className="h-3 w-3 stroke-[2.5]" />}
                        </div>
                        <UserAvatar
                          name={u.name}
                          avatarUrl={u.avatarUrl}
                          size="xs"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-[#20232B]">
                            {u.name}
                            {isManager && (
                              <span className="ml-1.5 text-[10px] text-[#635BDB]">
                                (Lead)
                              </span>
                            )}
                          </p>
                          <p className="truncate text-[10.5px] text-[#737987]">
                            {u.designation || u.email}
                          </p>
                        </div>
                      </div>

                      {u.department?.name ? (
                        <span className="shrink-0 rounded-[4px] border border-[#EAECF0] bg-[#F7F8FA] px-2 py-0.5 text-[10.5px] font-medium text-[#525866]">
                          {u.department.name}
                        </span>
                      ) : (
                        <span className="shrink-0 text-[10.5px] text-[#9CA3AF]">
                          No Dept
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

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
