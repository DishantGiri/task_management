"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Building2,
  CheckCircle2,
  Clock,
  Loader2,
  MoreHorizontal,
  Pencil,
  Power,
  Search,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import type { Role } from "@prisma/client";
import {
  approveEmployeeAction,
  toggleEmployeeStatusAction,
} from "@/actions/employees";
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
import { PaginationBar } from "@/components/shared/pagination-bar";

export function TeamClient({
  employees,
  pendingEmployees: serverPendingEmployees,
  departments,
  currentUserId,
  currentUserRole,
  serverPagination,
}: {
  employees: EmployeeRow[];
  pendingEmployees?: EmployeeRow[];
  departments: { id: string; name: string }[];
  currentUserId: string;
  currentUserRole: Role;
  serverPagination?: {
    page: number;
    pageSize: number;
    totalItems: number;
    summary: {
      totalUsers: number;
      activeCount: number;
      pendingCount: number;
      managersCount: number;
    };
    filters: { q: string; dept: string; role: string; status: string };
  };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(
    serverPagination?.filters.q ?? searchParams.get("q") ?? ""
  );
  const [deptFilter, setDeptFilter] = useState(
    serverPagination?.filters.dept ?? "ALL"
  );
  const [roleFilter, setRoleFilter] = useState(
    serverPagination?.filters.role ?? "ALL"
  );
  const [statusFilter, setStatusFilter] = useState(
    serverPagination?.filters.status ?? searchParams.get("status") ?? "ALL"
  );

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EmployeeRow | null>(null);

  // Per-user role & department selection in the Pending Approvals queue
  const [pendingRoleMap, setPendingRoleMap] = useState<Record<string, Role>>(
    {}
  );
  const [pendingDeptMap, setPendingDeptMap] = useState<Record<string, string>>(
    {}
  );
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const isAdmin = currentUserRole === "ADMIN";

  const pendingEmployees = useMemo(
    () =>
      serverPendingEmployees ??
      employees.filter(
        (e) => e.status === "PENDING" || e.status === "INVITED"
      ),
    [serverPendingEmployees, employees]
  );

  const navigateTeam = (overrides: {
    page?: number;
    q?: string;
    dept?: string;
    role?: string;
    status?: string;
  }) => {
    const nextQ = overrides.q !== undefined ? overrides.q : search;
    const nextDept = overrides.dept !== undefined ? overrides.dept : deptFilter;
    const nextRole = overrides.role !== undefined ? overrides.role : roleFilter;
    const nextStatus =
      overrides.status !== undefined ? overrides.status : statusFilter;
    const nextPage = overrides.page ?? 1;

    const sp = new URLSearchParams();
    if (nextQ.trim()) sp.set("q", nextQ.trim());
    if (nextDept !== "ALL") sp.set("dept", nextDept);
    if (nextRole !== "ALL") sp.set("role", nextRole);
    if (nextStatus !== "ALL") sp.set("status", nextStatus);
    if (nextPage > 1) sp.set("page", String(nextPage));
    const qs = sp.toString();
    router.push(qs ? `/team?${qs}` : "/team");
  };

  const PAGE_SIZE = serverPagination?.pageSize ?? 10;
  const safePage = serverPagination?.page ?? 1;
  const totalItems = serverPagination?.totalItems ?? employees.length;
  const paginatedEmployees = employees;

  const handleApproveUser = async (emp: EmployeeRow) => {
    const chosenRole = pendingRoleMap[emp.id] || emp.role || "EMPLOYEE";
    const chosenDept =
      pendingDeptMap[emp.id] !== undefined
        ? pendingDeptMap[emp.id]
        : emp.departmentId || "";

    setApprovingId(emp.id);
    const res = await approveEmployeeAction({
      userId: emp.id,
      role: chosenRole,
      departmentId: chosenDept || null,
    });
    setApprovingId(null);

    if (res.error) {
      toast.error(res.error);
      return;
    }

    toast.success(
      `Approved ${emp.name} as ${chosenRole}. They can now access the dashboard.`
    );
    router.refresh();
  };

  const handleToggleStatus = async (emp: EmployeeRow) => {
    const res = await toggleEmployeeStatusAction(emp.id);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(
      res.status === "INACTIVE"
        ? `Deactivated ${emp.name}`
        : `Activated ${emp.name}`
    );
    router.refresh();
  };

  const totalUsersCount =
    serverPagination?.summary.totalUsers ?? employees.length;
  const activeCount =
    serverPagination?.summary.activeCount ??
    employees.filter((e) => e.status === "ACTIVE").length;
  const managersCount =
    serverPagination?.summary.managersCount ??
    employees.filter((e) => e.role === "ADMIN" || e.role === "MANAGER").length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight text-[#20232B]">
            Team
          </h1>
          <p className="text-[13px] text-[#737987] mt-0.5">
            Manage team members, roles, approvals, and company departments.
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
            Pre-Approve Gmail User
          </Button>
        )}
      </div>

      {/* Unified Team Sub-Navigation: Members | Departments */}
      <div className="inline-flex items-center rounded-md border border-[#EAECF0] bg-white p-0.5 shadow-subtle">
        <Link
          href="/team"
          className="inline-flex items-center gap-1.5 rounded-[5px] bg-[#F0EFFF] px-3 py-1.5 text-xs font-semibold text-[#5148C9]"
        >
          <Users className="h-3.5 w-3.5" />
          Members
        </Link>
        <Link
          href="/departments"
          className="inline-flex items-center gap-1.5 rounded-[5px] px-3 py-1.5 text-xs font-medium text-[#737987] hover:text-[#20232B] transition-colors"
        >
          <Building2 className="h-3.5 w-3.5" />
          Departments
        </Link>
      </div>

      {/* Admin Approval Queue Banner for Users On Hold */}
      {isAdmin && pendingEmployees.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50/70 p-4 shadow-subtle space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-500 text-white">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-[14px] font-semibold text-[#20232B]">
                  Pending Account Approvals ({pendingEmployees.length} On Hold)
                </h2>
                <p className="text-xs text-[#525866]">
                  These team members signed in with Google and are waiting on
                  hold. Assign their role and click{" "}
                  <strong>Approve &amp; Grant Access</strong> to unlock their
                  dashboard.
                </p>
              </div>
            </div>
          </div>

          <div className="divide-y divide-[#EAECF0] rounded-lg border border-[#EAECF0] bg-white">
            {pendingEmployees.map((emp) => {
              const selectedRole =
                pendingRoleMap[emp.id] || emp.role || "EMPLOYEE";
              const selectedDept =
                pendingDeptMap[emp.id] !== undefined
                  ? pendingDeptMap[emp.id]
                  : emp.departmentId || "__none__";

              return (
                <div
                  key={emp.id}
                  className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <UserAvatar
                      name={emp.name}
                      avatarUrl={emp.avatarUrl}
                      size="md"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-[13.5px] text-[#20232B] truncate">
                          {emp.name}
                        </p>
                        <span className="inline-flex items-center gap-1 rounded-[4px] border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10.5px] font-medium text-amber-800">
                          On Hold
                        </span>
                      </div>
                      <p className="text-xs text-[#737987] truncate">
                        {emp.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={selectedDept}
                      onValueChange={(v) =>
                        setPendingDeptMap((prev) => ({
                          ...prev,
                          [emp.id]: v === "__none__" ? "" : v,
                        }))
                      }
                    >
                      <SelectTrigger className="h-8 w-[148px] text-xs">
                        <SelectValue placeholder="Department" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">No Department</SelectItem>
                        {departments.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={selectedRole}
                      onValueChange={(v) =>
                        setPendingRoleMap((prev) => ({
                          ...prev,
                          [emp.id]: v as Role,
                        }))
                      }
                    >
                      <SelectTrigger className="h-8 w-[135px] text-xs font-medium">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EMPLOYEE">Role: Employee</SelectItem>
                        <SelectItem value="MANAGER">Role: Manager</SelectItem>
                        <SelectItem value="ADMIN">Role: Admin</SelectItem>
                      </SelectContent>
                    </Select>

                    <Button
                      size="sm"
                      className="h-8 bg-[#16A34A] hover:bg-[#15803D] text-white"
                      disabled={approvingId === emp.id}
                      onClick={() => handleApproveUser(emp)}
                    >
                      {approvingId === emp.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      )}
                      Approve &amp; Grant Access
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => handleToggleStatus(emp)}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Compact Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-[#EAECF0] bg-white p-4 shadow-subtle">
          <div className="flex items-center justify-between text-xs text-[#737987]">
            <span>Total Directory</span>
            <Users className="h-4 w-4 text-[#635BDB]" />
          </div>
          <p className="mt-1.5 text-2xl font-semibold text-[#20232B]">
            {totalUsersCount}
          </p>
        </div>
        <div className="rounded-lg border border-[#EAECF0] bg-white p-4 shadow-subtle">
          <div className="flex items-center justify-between text-xs text-[#737987]">
            <span>Approved &amp; Active</span>
            <span className="h-2.5 w-2.5 rounded-full bg-[#16A34A]" />
          </div>
          <p className="mt-1.5 text-2xl font-semibold text-[#20232B]">
            {activeCount}
          </p>
        </div>
        <div className="rounded-lg border border-[#EAECF0] bg-white p-4 shadow-subtle">
          <div className="flex items-center justify-between text-xs text-[#737987]">
            <span>On Hold (Pending)</span>
            <Clock className="h-4 w-4 text-[#F59E0B]" />
          </div>
          <p className="mt-1.5 text-2xl font-semibold text-[#F59E0B]">
            {pendingEmployees.length}
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
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                navigateTeam({ q: search, page: 1 });
              }
            }}
            onBlur={() => {
              if (search.trim() !== (serverPagination?.filters.q ?? "")) {
                navigateTeam({ q: search, page: 1 });
              }
            }}
            placeholder="Search by name, email, designation... (Enter)"
            className="h-8 w-full rounded-md border border-[#E2E6EE] bg-white pl-8 pr-3 text-xs focus:border-[#635BDB] focus:outline-none"
          />
        </div>

        <Select
          value={deptFilter}
          onValueChange={(v) => {
            setDeptFilter(v);
            navigateTeam({ dept: v, page: 1 });
          }}
        >
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

        <Select
          value={roleFilter}
          onValueChange={(v) => {
            setRoleFilter(v);
            navigateTeam({ role: v, page: 1 });
          }}
        >
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

        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            navigateTeam({ status: v, page: 1 });
          }}
        >
          <SelectTrigger className="h-8 w-[150px] text-xs">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            <SelectItem value="ACTIVE">Approved (Active)</SelectItem>
            <SelectItem value="PENDING">On Hold (Pending)</SelectItem>
            <SelectItem value="INACTIVE">Deactivated</SelectItem>
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
                <th className="py-2.5 px-3">Access Status</th>
                <th className="py-2.5 px-3">Workload</th>
                <th className="py-2.5 px-3">Projects</th>
                {isAdmin && (
                  <th className="py-2.5 pl-3 pr-4 text-right">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAECF0] text-[13px]">
              {paginatedEmployees.length === 0 ? (
                <tr>
                  <td
                    colSpan={isAdmin ? 7 : 6}
                    className="py-12 text-center text-xs text-[#737987]"
                  >
                    No employees match your filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedEmployees.map((emp) => {
                  const pct =
                    emp.stats.totalTasks > 0
                      ? Math.round(
                          (emp.stats.completedTasks / emp.stats.totalTasks) *
                            100
                        )
                      : 0;
                  const isPending =
                    emp.status === "PENDING" || emp.status === "INVITED";

                  return (
                    <tr
                      key={emp.id}
                      className={cn(
                        "hover:bg-[#F7F8FA]/80 transition-colors",
                        isPending && "bg-amber-50/30"
                      )}
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
                              : isPending
                              ? "border-amber-200 bg-amber-50 text-amber-800"
                              : "border-zinc-200 bg-zinc-100 text-zinc-600"
                          )}
                        >
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              emp.status === "ACTIVE"
                                ? "bg-emerald-500"
                                : isPending
                                ? "bg-amber-500"
                                : "bg-zinc-400"
                            )}
                          />
                          {emp.status === "ACTIVE"
                            ? "Approved"
                            : isPending
                            ? "On Hold (Pending)"
                            : "Deactivated"}
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
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {isPending && (
                                <DropdownMenuItem
                                  onClick={() => handleApproveUser(emp)}
                                  className="text-emerald-700 focus:text-emerald-700 focus:bg-emerald-50"
                                >
                                  <UserCheck className="h-3.5 w-3.5" />
                                  Approve &amp; Activate
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditing(emp);
                                  setFormOpen(true);
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5 text-[#737987]" />
                                Assign Role &amp; Edit
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

      <PaginationBar
        currentPage={safePage}
        totalItems={totalItems}
        pageSize={PAGE_SIZE}
        onPageChange={(nextPage) => navigateTeam({ page: nextPage })}
        itemLabel="employees"
      />

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
