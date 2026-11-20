"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Check,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import type { Role } from "@prisma/client";
import {
  createDepartmentAction,
  deleteDepartmentAction,
  updateDepartmentAction,
} from "@/actions/employees";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { UserAvatar } from "@/components/ui/avatar";
import { RoleBadge } from "@/components/shared/badges";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface DepartmentEmployeeItem {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  designation: string | null;
  role: Role;
  departmentId: string | null;
  departmentName: string | null;
}

export interface DepartmentItem {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  users: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    designation: string | null;
    role: Role;
  }[];
}

export function DepartmentsClient({
  departments,
  allEmployees,
  currentUserRole,
}: {
  departments: DepartmentItem[];
  allEmployees: DepartmentEmployeeItem[];
  currentUserRole: Role;
}) {
  const router = useRouter();
  const isAdmin = currentUserRole === "ADMIN";

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<DepartmentItem | null>(null);
  const [deletingDept, setDeletingDept] = useState<DepartmentItem | null>(null);

  // Modal Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!formOpen) return;
    setMemberSearch("");
    if (editingDept) {
      setName(editingDept.name);
      setDescription(editingDept.description || "");
      setSelectedMemberIds(editingDept.users.map((u) => u.id));
    } else {
      setName("");
      setDescription("");
      setSelectedMemberIds([]);
    }
  }, [formOpen, editingDept]);

  const filteredDepartments = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return departments;
    return departments.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        (d.description || "").toLowerCase().includes(q) ||
        d.users.some((u) => u.name.toLowerCase().includes(q))
    );
  }, [departments, search]);

  const filteredModalEmployees = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return allEmployees;
    return allEmployees.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.designation || "").toLowerCase().includes(q) ||
        (u.departmentName || "").toLowerCase().includes(q)
    );
  }, [allEmployees, memberSearch]);

  const toggleMember = (uid: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Department name is required");
      return;
    }

    setSubmitting(true);
    const res = editingDept
      ? await updateDepartmentAction({
          id: editingDept.id,
          name: name.trim(),
          description: description.trim() || null,
          memberIds: selectedMemberIds,
        })
      : await createDepartmentAction({
          name: name.trim(),
          description: description.trim() || null,
          memberIds: selectedMemberIds,
        });
    setSubmitting(false);

    if (res.error) {
      toast.error(res.error);
      return;
    }

    toast.success(
      editingDept ? "Department updated" : "Department created"
    );
    setFormOpen(false);
    setEditingDept(null);
    router.refresh();
  };

  const handleDelete = async () => {
    if (!deletingDept) return;
    setDeleting(true);
    const res = await deleteDepartmentAction(deletingDept.id);
    setDeleting(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(`Deleted department "${deletingDept.name}"`);
    setDeletingDept(null);
    router.refresh();
  };

  const assignedCount = allEmployees.filter((e) => !!e.departmentId).length;
  const unassignedCount = allEmployees.length - assignedCount;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight text-[#20232B]">
            Department Management
          </h1>
          <p className="text-[13px] text-[#737987] mt-0.5">
            Create, edit, and organize company departments and assign team members.
          </p>
        </div>

        {isAdmin && (
          <Button
            size="sm"
            onClick={() => {
              setEditingDept(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            New Department
          </Button>
        )}
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-lg border border-[#EAECF0] bg-white p-4 shadow-subtle">
          <div className="flex items-center justify-between text-xs text-[#737987]">
            <span>Total Departments</span>
            <Building2 className="h-4 w-4 text-[#635BDB]" />
          </div>
          <p className="mt-1.5 text-2xl font-semibold text-[#20232B]">
            {departments.length}
          </p>
        </div>
        <div className="rounded-lg border border-[#EAECF0] bg-white p-4 shadow-subtle">
          <div className="flex items-center justify-between text-xs text-[#737987]">
            <span>Assigned Employees</span>
            <Users className="h-4 w-4 text-[#16A34A]" />
          </div>
          <p className="mt-1.5 text-2xl font-semibold text-[#20232B]">
            {assignedCount}
          </p>
        </div>
        <div className="rounded-lg border border-[#EAECF0] bg-white p-4 shadow-subtle">
          <div className="flex items-center justify-between text-xs text-[#737987]">
            <span>Unassigned Employees</span>
            <Users className="h-4 w-4 text-[#F59E0B]" />
          </div>
          <p className="mt-1.5 text-2xl font-semibold text-[#20232B]">
            {unassignedCount}
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-2.5">
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9CA3AF]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search departments or members..."
            className="h-8 w-full rounded-md border border-[#E2E6EE] bg-white pl-8 pr-3 text-xs focus:border-[#635BDB] focus:outline-none"
          />
        </div>
      </div>

      {/* Departments Grid */}
      {filteredDepartments.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#D9DEE7] bg-white py-16 text-center">
          <Building2 className="mx-auto h-6 w-6 text-[#9CA3AF] mb-2" />
          <p className="text-sm font-medium text-[#20232B]">
            No departments found
          </p>
          <p className="mt-1 text-xs text-[#737987]">
            {isAdmin
              ? "Click 'New Department' to create your first company department."
              : "No departments match your search."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredDepartments.map((dept) => (
            <div
              key={dept.id}
              className="flex flex-col rounded-lg border border-[#EAECF0] bg-white p-5 shadow-subtle transition-all hover:border-[#C7CBE0] hover:shadow-card"
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#F0EFFF] text-[#635BDB]">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-[15px] font-semibold text-[#20232B]">
                      {dept.name}
                    </h3>
                    <p className="text-[11px] text-[#737987]">
                      {dept.users.length}{" "}
                      {dept.users.length === 1 ? "member" : "members"}
                    </p>
                  </div>
                </div>

                {isAdmin && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setEditingDept(dept);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5 text-[#737987]" />
                        Edit Department &amp; Members
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-600 focus:text-red-600 focus:bg-red-50"
                        onClick={() => setDeletingDept(dept)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete Department
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              {/* Description */}
              <p className="mt-3 text-[12.5px] leading-relaxed text-[#525866] line-clamp-2 min-h-[38px]">
                {dept.description || "No department description provided."}
              </p>

              {/* Members Preview */}
              <div className="mt-4 pt-3 border-t border-[#F1F3F7] flex-1 flex flex-col justify-between space-y-3">
                {dept.users.length === 0 ? (
                  <p className="text-xs text-[#9CA3AF] py-2">
                    No employees assigned yet.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                    {dept.users.map((u) => (
                      <div
                        key={u.id}
                        className="flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <UserAvatar
                            name={u.name}
                            avatarUrl={u.avatarUrl}
                            size="xs"
                          />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-[#20232B]">
                              {u.name}
                            </p>
                            <p className="truncate text-[10.5px] text-[#737987]">
                              {u.designation || u.email}
                            </p>
                          </div>
                        </div>
                        <RoleBadge role={u.role} />
                      </div>
                    ))}
                  </div>
                )}

                {isAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-8 text-xs mt-2"
                    onClick={() => {
                      setEditingDept(dept);
                      setFormOpen(true);
                    }}
                  >
                    <Pencil className="h-3 w-3" />
                    Manage Department &amp; Members
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Department Modal */}
      {isAdmin && (
        <Dialog open={formOpen} onOpenChange={setFormOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingDept ? "Edit Department" : "Create Department"}
              </DialogTitle>
              <DialogDescription>
                Configure department name, description, and assign employees.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="dept-name">Department Name</Label>
                <Input
                  id="dept-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., SEO, Video Generation, Developement"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dept-desc">Description</Label>
                <Textarea
                  id="dept-desc"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Responsibilities and focus area of this department..."
                />
              </div>

              {/* Assign Employees to Department */}
              <div className="space-y-2 rounded-lg border border-[#EAECF0] bg-[#F7F8FA] p-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-[#20232B]">
                    Department Members ({selectedMemberIds.length} assigned)
                  </Label>
                  {selectedMemberIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedMemberIds([])}
                      className="text-[11px] text-[#737987] hover:text-[#20232B]"
                    >
                      Clear all
                    </button>
                  )}
                </div>

                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9CA3AF]" />
                  <input
                    type="text"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder="Search employees by name or email..."
                    className="h-8 w-full rounded-md border border-[#E2E6EE] bg-white pl-8 pr-3 text-xs text-[#20232B] placeholder:text-[#9CA3AF] focus:border-[#635BDB] focus:outline-none"
                  />
                </div>

                <div className="max-h-44 overflow-y-auto divide-y divide-[#EAECF0] rounded-md border border-[#EAECF0] bg-white">
                  {filteredModalEmployees.length === 0 ? (
                    <p className="py-6 text-center text-xs text-[#737987]">
                      No employees found.
                    </p>
                  ) : (
                    filteredModalEmployees.map((emp) => {
                      const active = selectedMemberIds.includes(emp.id);
                      return (
                        <button
                          key={emp.id}
                          type="button"
                          onClick={() => toggleMember(emp.id)}
                          className={cn(
                            "flex w-full items-center justify-between gap-2.5 px-3 py-2 text-left text-xs transition-colors hover:bg-[#F7F8FA]",
                            active && "bg-[#F0EFFF]/45"
                          )}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={cn(
                                "flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border",
                                active
                                  ? "border-[#635BDB] bg-[#635BDB] text-white"
                                  : "border-[#D1D5DB] bg-white"
                              )}
                            >
                              {active && (
                                <Check className="h-3 w-3 stroke-[2.5]" />
                              )}
                            </div>
                            <UserAvatar
                              name={emp.name}
                              avatarUrl={emp.avatarUrl}
                              size="xs"
                            />
                            <div className="min-w-0">
                              <p className="truncate font-medium text-[#20232B]">
                                {emp.name}
                              </p>
                              <p className="truncate text-[10.5px] text-[#737987]">
                                {emp.designation || emp.email}
                              </p>
                            </div>
                          </div>

                          {emp.departmentName &&
                            emp.departmentId !== editingDept?.id && (
                              <span className="shrink-0 rounded bg-[#F3F4F6] px-1.5 py-0.5 text-[10px] text-[#737987]">
                                Currently: {emp.departmentName}
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
                  onClick={() => setFormOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  )}
                  {editingDept ? "Save Changes" : "Create Department"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      {isAdmin && (
        <Dialog
          open={!!deletingDept}
          onOpenChange={(open) => !open && setDeletingDept(null)}
        >
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete {deletingDept?.name}?</DialogTitle>
              <DialogDescription>
                This will remove the department. The{" "}
                {deletingDept?.users.length || 0} assigned employee(s) will remain
                active and become unassigned.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeletingDept(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Delete Department
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
