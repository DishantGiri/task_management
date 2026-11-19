"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  MoreHorizontal,
  Pencil,
  Power,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import type { Role } from "@prisma/client";
import { toggleEmployeeStatusAction } from "@/actions/employees";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { RoleBadge } from "@/components/shared/badges";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  EmployeeFormDialog,
  type EmployeeRow,
} from "@/components/employees/employee-form-dialog";

export function TeamClient({
  employees,
  departments,
  currentUserId,
  currentUserRole,
}: {
  employees: EmployeeRow[];
  departments: { id: string; name: string }[];
  currentUserId: string;
  currentUserRole: Role;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EmployeeRow | null>(null);

  const isAdmin = currentUserRole === "ADMIN";

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter((emp) => {
      if (deptFilter !== "ALL" && (emp.departmentId || "NONE") !== deptFilter)
        return false;
      if (roleFilter !== "ALL" && emp.role !== roleFilter) return false;
      if (statusFilter !== "ALL" && emp.status !== statusFilter) return false;
      if (q) {
        const match =
          emp.name.toLowerCase().includes(q) ||
          emp.email.toLowerCase().includes(q) ||
          (emp.designation || "").toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [employees, search, deptFilter, roleFilter, statusFilter]);

  const handleToggleStatus = async (emp: EmployeeRow) => {
    const res = await toggleEmployeeStatusAction(emp.id);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(
      res.status === "INACTIVE"
        ? `Deactivated ${emp.name}`
        : `Reactivated ${emp.name}`
    );
    router.refresh();
  };

  const activeCount = employees.filter((e) => e.status === "ACTIVE").length;
  const managersCount = employees.filter(
    (e) => e.role === "ADMIN" || e.role === "MANAGER"
  ).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight text-[#20232B]">
            Team &amp; Employees
          </h1>
          <p className="text-[13px] text-[#737987] mt-0.5">
            Organization directory, departments, access roles, and workload visibility.
          </p>
        </div>

        {isAdmin && (
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <UserPlus className="h-4 w-4" />
            Invite Employee
          </Button>
        )}
      </div>

      {/* Compact Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-lg border border-[#EAECF0] bg-white p-4 shadow-subtle">
          <div className="flex items-center justify-between text-xs text-[#737987]">
            <span>Total Directory</span>
            <Users className="h-4 w-4 text-[#635BDB]" />
          </div>
          <p className="mt-1.5 text-2xl font-semibold text-[#20232B]">
            {employees.length}
          </p>
        </div>
        <div className="rounded-lg border border-[#EAECF0] bg-white p-4 shadow-subtle">
          <div className="flex items-center justify-between text-xs text-[#737987]">
            <span>Active Accounts</span>
            <span className="h-2.5 w-2.5 rounded-full bg-[#16A34A]" />
          </div>
          <p className="mt-1.5 text-2xl font-semibold text-[#20232B]">
            {activeCount}
          </p>
        </div>
        <div className="rounded-lg border border-[#EAECF0] bg-white p-4 shadow-subtle">
          <div className="flex items-center justify-between text-xs text-[#737987]">
            <span>Admins &amp; Managers</span>
            <ShieldCheck className="h-4 w-4 text-[#3B82F6]" />
          </div>
          <p className="mt-1.5 text-2xl font-semibold text-[#20232B]">
            {managersCount}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9CA3AF]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, designation..."
            className="h-8 w-full rounded-md border border-[#E2E6EE] bg-white pl-8 pr-3 text-xs focus:border-[#635BDB] focus:outline-none"
          />
        </div>

        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="h-8 w-[150px] text-xs">
            <SelectValue placeholder="All Departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Departments</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="h-8 w-[130px] text-xs">
            <SelectValue placeholder="All Roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Roles</SelectItem>
            <SelectItem value="ADMIN">Admin</SelectItem>
            <SelectItem value="MANAGER">Manager</SelectItem>
            <SelectItem value="EMPLOYEE">Employee</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-[130px] text-xs">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="INVITED">Invited</SelectItem>
            <SelectItem value="INACTIVE">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Employee Data Table */}
      <div className="rounded-lg border border-[#EAECF0] bg-white shadow-subtle overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b border-[#EAECF0] bg-[#F7F8FA] text-[11px] font-semibold uppercase tracking-wider text-[#737987]">
                <th className="py-2.5 pl-4 pr-3">Employee</th>
                <th className="py-2.5 px-3">Department</th>
                <th className="py-2.5 px-3">Role</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Workload</th>
                <th className="py-2.5 px-3">Projects</th>
                {isAdmin && <th className="py-2.5 pl-3 pr-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAECF0] text-[13px]">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={isAdmin ? 7 : 6}
                    className="py-12 text-center text-xs text-[#737987]"
                  >
                    No employees match your filter criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((emp) => {
                  const pct =
                    emp.stats.totalTasks > 0
                      ? Math.round(
                          (emp.stats.completedTasks / emp.stats.totalTasks) *
                            100
                        )
                      : 0;

                  return (
                    <tr
                      key={emp.id}
                      className="hover:bg-[#F7F8FA]/80 transition-colors"
                    >
                      <td className="py-3 pl-4 pr-3">
                        <div className="flex items-center gap-3">
                          <UserAvatar
                            name={emp.name}
                            avatarUrl={emp.avatarUrl}
                            size="md"
                          />
                          <div className="min-w-0">
                            <p className="font-medium text-[#20232B] truncate">
                              {emp.name}
                              {emp.id === currentUserId && (
                                <span className="ml-1.5 text-[10px] font-normal text-[#737987]">
                                  (You)
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-[#737987] truncate">
                              {emp.designation
                                ? `${emp.designation} · ${emp.email}`
                                : emp.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-xs text-[#4B5563]">
                        {emp.department?.name || "—"}
                      </td>

                      <td className="py-3 px-3">
                        <RoleBadge role={emp.role} />
                      </td>

                      <td className="py-3 px-3">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-[5px] border px-2 py-0.5 text-[11px] font-medium",
                            emp.status === "ACTIVE"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : emp.status === "INVITED"
                              ? "border-amber-200 bg-amber-50 text-amber-700"
                              : "border-zinc-200 bg-zinc-100 text-zinc-600"
                          )}
                        >
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              emp.status === "ACTIVE"
                                ? "bg-emerald-500"
                                : emp.status === "INVITED"
                                ? "bg-amber-500"
                                : "bg-zinc-400"
                            )}
                          />
                          {emp.status === "ACTIVE"
                            ? "Active"
                            : emp.status === "INVITED"
                            ? "Invited"
                            : "Inactive"}
                        </span>
                      </td>

                      <td className="py-3 px-3 w-[180px]">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-[#4B5563] font-medium">
                              {emp.stats.activeTasks} active ·{" "}
                              {emp.stats.completedTasks} done
                            </span>
                            {emp.stats.overdueTasks > 0 && (
                              <span className="text-[#EF4444] font-semibold">
                                {emp.stats.overdueTasks} late
                              </span>
                            )}
                          </div>
                          <Progress value={pct} className="h-1.5" />
                        </div>
                      </td>

                      <td className="py-3 px-3 text-xs text-[#525866]">
                        {emp.stats.projectCount}
                      </td>

                      {isAdmin && (
                        <td className="py-3 pl-3 pr-4 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditing(emp);
                                  setFormOpen(true);
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5 text-[#737987]" />
                                Edit Profile &amp; Role
                              </DropdownMenuItem>
                              {emp.id !== currentUserId && (
                                <DropdownMenuItem
                                  onClick={() => handleToggleStatus(emp)}
                                  className={
                                    emp.status === "INACTIVE"
                                      ? "text-emerald-700 focus:text-emerald-700"
                                      : "text-red-600 focus:text-red-600 focus:bg-red-50"
                                  }
                                >
                                  <Power className="h-3.5 w-3.5" />
                                  {emp.status === "INACTIVE"
                                    ? "Reactivate Account"
                                    : "Deactivate Account"}
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isAdmin && (
        <EmployeeFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          departments={departments}
          editingEmployee={editing}
        />
      )}
    </div>
  );
}
