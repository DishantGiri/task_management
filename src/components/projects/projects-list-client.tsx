"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar,
  FolderKanban,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { Role } from "@prisma/client";
import type { ProjectListItem, UserSummary } from "@/types";
import { deleteProjectAction } from "@/actions/projects";
import { formatShortDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { UserAvatar } from "@/components/ui/avatar";
import {
  PriorityBadge,
  ProjectStatusBadge,
} from "@/components/shared/badges";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProjectFormDialog } from "@/components/projects/project-form-dialog";
import { PaginationBar } from "@/components/shared/pagination-bar";

export function ProjectsListClient({
  projects,
  users,
  departments = [],
  currentUserId,
  currentUserRole,
}: {
  projects: ProjectListItem[];
  users: UserSummary[];
  departments?: { id: string; name: string }[];
  currentUserId: string;
  currentUserRole: Role;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 9;

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectListItem | null>(null);
  const [deletingProject, setDeletingProject] =
    useState<ProjectListItem | null>(null);

  const canCreate =
    currentUserRole === "ADMIN" || currentUserRole === "MANAGER";

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter((p) => {
      if (statusFilter !== "ALL" && p.status !== statusFilter) return false;
      if (priorityFilter !== "ALL" && p.priority !== priorityFilter)
        return false;
      if (
        q &&
        !p.name.toLowerCase().includes(q) &&
        !p.code.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [projects, search, statusFilter, priorityFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedProjects = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  const handleDelete = async () => {
    if (!deletingProject) return;
    const res = await deleteProjectAction(deletingProject.id);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(`Project "${deletingProject.name}" deleted`);
    setDeletingProject(null);
    router.refresh();
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight text-[#20232B]">
            Projects
          </h1>
          <p className="text-[13px] text-[#737987] mt-0.5">
            Active initiatives, delivery timelines, project leads, and team workspaces.
          </p>
        </div>

        {canCreate && (
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9CA3AF]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects by name or code..."
            className="h-8 w-full rounded-md border border-[#E2E6EE] bg-white pl-8 pr-3 text-xs focus:border-[#635BDB] focus:outline-none"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="PLANNING">Planning</SelectItem>
            <SelectItem value="ON_HOLD">On Hold</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="ARCHIVED">Archived</SelectItem>
          </SelectContent>
        </Select>

        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue placeholder="All Priorities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Priorities</SelectItem>
            <SelectItem value="URGENT">Urgent</SelectItem>
            <SelectItem value="HIGH">High</SelectItem>
            <SelectItem value="MEDIUM">Medium</SelectItem>
            <SelectItem value="LOW">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Projects Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#D9DEE7] bg-white py-16 text-center">
          <FolderKanban className="mx-auto h-6 w-6 text-[#9CA3AF] mb-2" />
          <p className="text-sm font-medium text-[#20232B]">No projects found</p>
          <p className="mt-1 text-xs text-[#737987]">
            {canCreate
              ? "Create a project to organize tasks, milestones, and team members."
              : "You have not been assigned to any projects yet."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {paginatedProjects.map((project) => {
            const canManage =
              currentUserRole === "ADMIN" ||
              project.managerId === currentUserId ||
              project.members.some(
                (m) => m.user.id === currentUserId && m.role === "LEAD"
              );

            return (
              <div
                key={project.id}
                className="group flex flex-col rounded-lg border border-[#EAECF0] bg-white p-5 shadow-subtle transition-all hover:border-[#C7CBE0] hover:shadow-card"
              >
                {/* Top Bar */}
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/projects/${project.id}`}
                    className="flex items-center gap-2.5 min-w-0 flex-1"
                  >
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white"
                      style={{ backgroundColor: project.color }}
                    >
                      {project.code.slice(0, 3)}
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-[15px] font-semibold text-[#20232B] group-hover:text-[#5148C9] transition-colors">
                        {project.name}
                      </h3>
                      <p className="text-[11px] font-mono text-[#9CA3AF]">
                        {project.code} · Lead: {project.manager.name}
                      </p>
                    </div>
                  </Link>

                  {canManage && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditing(project);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5 text-[#737987]" />
                          Edit Project
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600 focus:text-red-600 focus:bg-red-50"
                          onClick={() => setDeletingProject(project)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete Project
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                {/* Description */}
                <p className="mt-3 text-[12.5px] leading-relaxed text-[#525866] line-clamp-2 min-h-[38px] break-words [overflow-wrap:anywhere]">
                  {project.description || "No project description provided."}
                </p>

                {/* Status & Priority */}
                <div className="mt-3 flex items-center gap-2">
                  <ProjectStatusBadge status={project.status} />
                  <PriorityBadge priority={project.priority} />
                  {project.taskStats.overdue > 0 && (
                    <span className="ml-auto text-[11px] font-medium text-[#EF4444]">
                      {project.taskStats.overdue} overdue
                    </span>
                  )}
                </div>

                {/* Progress */}
                <div className="mt-4 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#737987]">
                      {project.taskStats.completed}/{project.taskStats.total}{" "}
                      tasks completed
                    </span>
                    <span className="font-semibold text-[#20232B]">
                      {project.taskStats.progress}%
                    </span>
                  </div>
                  <Progress value={project.taskStats.progress} />
                </div>

                {/* Footer: Members + End Date */}
                <div className="mt-4 pt-3 border-t border-[#F1F3F7] flex items-center justify-between gap-2">
                  <div className="flex items-center -space-x-1.5">
                    {project.members.slice(0, 5).map((m) => (
                      <UserAvatar
                        key={m.id}
                        name={m.user.name}
                        avatarUrl={m.user.avatarUrl}
                        size="sm"
                        className="ring-2 ring-white"
                      />
                    ))}
                    {project.members.length > 5 && (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full border border-[#EAECF0] bg-[#F7F8FA] text-[10px] font-medium text-[#525866] ring-2 ring-white">
                        +{project.members.length - 5}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 text-[11.5px] text-[#737987]">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>
                      {project.endDate
                        ? formatShortDate(project.endDate)
                        : "No end date"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <PaginationBar
        currentPage={safePage}
        totalItems={filtered.length}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        itemLabel="projects"
      />

      <ProjectFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        users={users}
        departments={departments}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        editingProject={editing}
      />

      <Dialog
        open={!!deletingProject}
        onOpenChange={(open) => !open && setDeletingProject(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {deletingProject?.name}?</DialogTitle>
            <DialogDescription>
              All tasks, subtasks, comments, and activity logs in this project
              will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeletingProject(null)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
