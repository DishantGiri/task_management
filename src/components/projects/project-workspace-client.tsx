"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  Building2,
  Calendar,
  Check,
  Flag,
  ListTodo,
  Loader2,
  Megaphone,
  Pencil,
  Search,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import type { ProjectMemberRole, Role } from "@prisma/client";
import type {
  MilestoneItem,
  ProjectListItem,
  ProjectPostItem,
  TagSummary,
  TaskListItem,
  UserSummary,
} from "@/types";
import {
  addProjectMemberAction,
  addProjectMembersBatchAction,
  removeProjectMemberAction,
} from "@/actions/projects";
import { cn, formatRelativeTime, formatShortDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { UserAvatar } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PriorityBadge,
  ProjectStatusBadge,
  RoleBadge,
} from "@/components/shared/badges";
import { TasksWorkspace } from "@/components/tasks/tasks-workspace";
import { ProjectFormDialog } from "@/components/projects/project-form-dialog";
import { ProjectMilestonesTab } from "@/components/projects/project-milestones-tab";
import { ProjectPostsTab } from "@/components/projects/project-posts-tab";
import { RecentActivityCard } from "@/components/dashboard/recent-activity-card";
import { Skeleton } from "@/components/ui/skeleton";

interface ProjectActivityItem {
  id: string;
  description: string;
  createdAt: string;
  actor: { id: string; name: string; avatarUrl: string | null };
}

export function ProjectWorkspaceClient({
  project,
  tasks,
  milestones = [],
  posts = [],
  allUsers,
  departments = [],
  tags,
  activities,
  currentUserId,
  currentUserRole,
  canManage,
}: {
  project: ProjectListItem;
  tasks: TaskListItem[];
  milestones?: MilestoneItem[];
  posts?: ProjectPostItem[];
  allUsers: UserSummary[];
  departments?: { id: string; name: string }[];
  tags: TagSummary[];
  activities: ProjectActivityItem[];
  currentUserId: string;
  currentUserRole: Role;
  canManage: boolean;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);

  // Add members filter, search, and selection state
  const [addSearch, setAddSearch] = useState("");
  const [addDeptFilter, setAddDeptFilter] = useState("ALL");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState<ProjectMemberRole>("MEMBER");
  const [addingMember, setAddingMember] = useState(false);

  // Current members filter & search state
  const [existingSearch, setExistingSearch] = useState("");
  const [existingDeptFilter, setExistingDeptFilter] = useState("ALL");

  const departmentOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of departments) {
      map.set(d.id, d.name);
    }
    for (const u of allUsers) {
      if (u.department?.id && u.department?.name) {
        map.set(u.department.id, u.department.name);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [departments, allUsers]);

  const memberUserIds = useMemo(
    () => new Set(project.members.map((m) => m.user.id)),
    [project.members]
  );

  const nonMembers = useMemo(
    () => allUsers.filter((u) => !memberUserIds.has(u.id)),
    [allUsers, memberUserIds]
  );

  const filteredNonMembers = useMemo(() => {
    const q = addSearch.trim().toLowerCase();
    return nonMembers.filter((u) => {
      if (addDeptFilter === "UNASSIGNED" && u.department?.id) return false;
      if (
        addDeptFilter !== "ALL" &&
        addDeptFilter !== "UNASSIGNED" &&
        u.department?.id !== addDeptFilter
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
  }, [nonMembers, addSearch, addDeptFilter]);

  const filteredExistingMembers = useMemo(() => {
    const q = existingSearch.trim().toLowerCase();
    return project.members.filter((m) => {
      const u = m.user;
      if (existingDeptFilter === "UNASSIGNED" && u.department?.id) return false;
      if (
        existingDeptFilter !== "ALL" &&
        existingDeptFilter !== "UNASSIGNED" &&
        u.department?.id !== existingDeptFilter
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
  }, [project.members, existingSearch, existingDeptFilter]);

  const toggleCandidate = (uid: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const handleQuickAddSingle = async (uid: string) => {
    setAddingMember(true);
    const res = await addProjectMemberAction(project.id, uid, selectedRole);
    setAddingMember(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setSelectedUserIds((prev) => prev.filter((id) => id !== uid));
    toast.success("Member added to project");
    router.refresh();
  };

  const handleAddSelectedBatch = async (idsToUse?: string[]) => {
    const ids = idsToUse || selectedUserIds;
    if (ids.length === 0) return;
    setAddingMember(true);
    const res = await addProjectMembersBatchAction(
      project.id,
      ids,
      selectedRole
    );
    setAddingMember(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(`Added ${res.count} member(s) to project`);
    setSelectedUserIds([]);
    router.refresh();
  };

  const handleRemoveMember = async (uid: string) => {
    const res = await removeProjectMemberAction(project.id, uid);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Member removed");
    router.refresh();
  };

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <Link
        href="/projects"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#737987] hover:text-[#20232B]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Projects
      </Link>

      {/* Project Header Card */}
      <div className="rounded-lg border border-[#EAECF0] bg-white p-5 shadow-subtle overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0 flex-1">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
              style={{ backgroundColor: project.color }}
            >
              {project.code.slice(0, 3)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[22px] font-semibold tracking-tight text-[#20232B] break-words">
                  {project.name}
                </h1>
                <span className="font-mono text-xs text-[#9CA3AF]">
                  {project.code}
                </span>
                <ProjectStatusBadge status={project.status} />
                <PriorityBadge priority={project.priority} />
              </div>
              {project.description && (
                <p className="mt-1.5 max-w-3xl text-[13px] text-[#525866] leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                  {project.description}
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-[#737987]">
                <span className="inline-flex items-center gap-1.5">
                  <UserAvatar
                    name={project.manager.name}
                    avatarUrl={project.manager.avatarUrl}
                    size="xs"
                  />
                  Lead:{" "}
                  <strong className="text-[#20232B]">
                    {project.manager.name}
                  </strong>
                </span>
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatShortDate(project.startDate)} –{" "}
                  {formatShortDate(project.endDate)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {project.members.length} members
                </span>
              </div>
            </div>
          </div>

          {/* Right Progress & Actions */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-3 shrink-0 min-w-[200px]">
            {canManage && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit Project
              </Button>
            )}
            <div className="w-full sm:w-52">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-[#737987]">
                  {project.taskStats.completed}/{project.taskStats.total} done
                </span>
                <span className="font-semibold text-[#20232B]">
                  {project.taskStats.progress}%
                </span>
              </div>
              <Progress value={project.taskStats.progress} className="h-2" />
            </div>
          </div>
        </div>
      </div>

      {/* Workspace Tabs */}
      <Tabs defaultValue="tasks">
        <TabsList>
          <TabsTrigger value="tasks" className="gap-1.5">
            <ListTodo className="h-3.5 w-3.5" />
            Tasks ({tasks.length})
          </TabsTrigger>
          <TabsTrigger value="milestones" className="gap-1.5">
            <Flag className="h-3.5 w-3.5" />
            Milestones ({milestones.length})
          </TabsTrigger>
          <TabsTrigger value="posts" className="gap-1.5">
            <Megaphone className="h-3.5 w-3.5" />
            Announcements ({posts.length})
          </TabsTrigger>
          <TabsTrigger value="members" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Members ({project.members.length})
          </TabsTrigger>
          {(currentUserRole !== "EMPLOYEE" || canManage) && (
            <TabsTrigger value="activity" className="gap-1.5">
              <Activity className="h-3.5 w-3.5" />
              Activity ({activities.length})
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="tasks">
          <Suspense fallback={<Skeleton className="h-[460px] w-full" />}>
            <TasksWorkspace
              initialTasks={tasks}
              milestones={milestones.map((m) => ({
                id: m.id,
                title: m.title,
                status: m.status,
                dueDate: m.dueDate,
                projectId: m.projectId,
                projectName: project.name,
                projectColor: project.color,
                progress: m.taskStats.progress,
              }))}
              projects={[
                {
                  id: project.id,
                  code: project.code,
                  name: project.name,
                  color: project.color,
                  status: project.status,
                  priority: project.priority,
                },
              ]}
              users={allUsers}
              tags={tags}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              canManageProject={canManage}
              fixedProjectId={project.id}
              defaultView="kanban"
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="milestones">
          <ProjectMilestonesTab
            projectId={project.id}
            milestones={milestones}
            projectTasks={tasks}
            canManage={canManage}
          />
        </TabsContent>

        <TabsContent value="posts">
          <ProjectPostsTab
            projectId={project.id}
            posts={posts}
            users={allUsers}
            currentUserId={currentUserId}
            canManage={canManage}
          />
        </TabsContent>

        <TabsContent value="members">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Add Members Picker with Department Filter & Search */}
            {canManage && (
              <div className="lg:col-span-5 rounded-lg border border-[#EAECF0] bg-white p-4 shadow-subtle space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-[14px] font-semibold text-[#20232B]">
                      Add Team Members
                    </h3>
                    <p className="text-xs text-[#737987]">
                      Filter by department or search employees to add.
                    </p>
                  </div>
                  <Select
                    value={selectedRole}
                    onValueChange={(v) =>
                      setSelectedRole(v as ProjectMemberRole)
                    }
                  >
                    <SelectTrigger className="h-7 w-[118px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MEMBER">As Member</SelectItem>
                      <SelectItem value="LEAD">As Lead</SelectItem>
                      <SelectItem value="VIEWER">As Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Search & Department Filter */}
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9CA3AF]" />
                    <input
                      type="text"
                      value={addSearch}
                      onChange={(e) => setAddSearch(e.target.value)}
                      placeholder="Search by name, email, role..."
                      className="h-8 w-full rounded-md border border-[#E2E6EE] bg-[#F7F8FA] pl-8 pr-3 text-xs text-[#20232B] placeholder:text-[#9CA3AF] focus:border-[#635BDB] focus:bg-white focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Select
                      value={addDeptFilter}
                      onValueChange={setAddDeptFilter}
                    >
                      <SelectTrigger className="h-8 flex-1 text-xs">
                        <Building2 className="h-3.5 w-3.5 mr-1.5 text-[#737987]" />
                        <SelectValue placeholder="Filter by Department" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All Departments</SelectItem>
                        {departmentOptions.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
                          </SelectItem>
                        ))}
                        <SelectItem value="UNASSIGNED">
                          No Department
                        </SelectItem>
                      </SelectContent>
                    </Select>

                    {filteredNonMembers.length > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs shrink-0"
                        disabled={addingMember}
                        onClick={() =>
                          handleAddSelectedBatch(
                            filteredNonMembers.map((u) => u.id)
                          )
                        }
                      >
                        Add All ({filteredNonMembers.length})
                      </Button>
                    )}
                  </div>
                </div>

                {/* Available Employees List */}
                <div className="max-h-[320px] overflow-y-auto divide-y divide-[#EAECF0] rounded-md border border-[#EAECF0]">
                  {filteredNonMembers.length === 0 ? (
                    <p className="py-8 text-center text-xs text-[#737987]">
                      {nonMembers.length === 0
                        ? "All workspace employees are already in this project."
                        : "No available employees match this department or search."}
                    </p>
                  ) : (
                    filteredNonMembers.map((u) => {
                      const isChecked = selectedUserIds.includes(u.id);
                      return (
                        <div
                          key={u.id}
                          className={cn(
                            "flex items-center justify-between gap-2 px-3 py-2 text-xs transition-colors hover:bg-[#F7F8FA]",
                            isChecked && "bg-[#F0EFFF]/40"
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => toggleCandidate(u.id)}
                            className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
                          >
                            <div
                              className={cn(
                                "flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border",
                                isChecked
                                  ? "border-[#635BDB] bg-[#635BDB] text-white"
                                  : "border-[#D1D5DB] bg-white"
                              )}
                            >
                              {isChecked && (
                                <Check className="h-3 w-3 stroke-[2.5]" />
                              )}
                            </div>
                            <UserAvatar
                              name={u.name}
                              avatarUrl={u.avatarUrl}
                              size="xs"
                            />
                            <div className="min-w-0">
                              <p className="truncate font-medium text-[#20232B]">
                                {u.name}
                              </p>
                              <div className="flex items-center gap-1.5 text-[10.5px] text-[#737987]">
                                <span className="truncate">
                                  {u.department?.name || "No Dept"}
                                </span>
                                {u.designation && (
                                  <>
                                    <span>·</span>
                                    <span className="truncate">
                                      {u.designation}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </button>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-[#635BDB] hover:bg-[#F0EFFF] hover:text-[#5148C9]"
                            disabled={addingMember}
                            onClick={() => handleQuickAddSingle(u.id)}
                          >
                            <UserPlus className="h-3.5 w-3.5" />
                            Add
                          </Button>
                        </div>
                      );
                    })
                  )}
                </div>

                {selectedUserIds.length > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    className="w-full"
                    disabled={addingMember}
                    onClick={() => handleAddSelectedBatch()}
                  >
                    {addingMember ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <UserPlus className="h-3.5 w-3.5" />
                    )}
                    Add {selectedUserIds.length} Selected Member
                    {selectedUserIds.length > 1 ? "s" : ""}
                  </Button>
                )}
              </div>
            )}

            {/* Current Project Members List with Search & Department Filter */}
            <div
              className={cn(
                "space-y-3",
                canManage ? "lg:col-span-7" : "lg:col-span-12 max-w-4xl"
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-[14px] font-semibold text-[#20232B]">
                  Current Project Members ({filteredExistingMembers.length})
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative w-48">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9CA3AF]" />
                    <input
                      type="text"
                      value={existingSearch}
                      onChange={(e) => setExistingSearch(e.target.value)}
                      placeholder="Filter current members..."
                      className="h-8 w-full rounded-md border border-[#E2E6EE] bg-white pl-8 pr-3 text-xs focus:border-[#635BDB] focus:outline-none"
                    />
                  </div>
                  <Select
                    value={existingDeptFilter}
                    onValueChange={setExistingDeptFilter}
                  >
                    <SelectTrigger className="h-8 w-[150px] text-xs bg-white">
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
              </div>

              <div className="divide-y divide-[#EAECF0] rounded-lg border border-[#EAECF0] bg-white shadow-subtle">
                {filteredExistingMembers.length === 0 ? (
                  <p className="py-10 text-center text-xs text-[#737987]">
                    No project members match this filter.
                  </p>
                ) : (
                  filteredExistingMembers.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <UserAvatar
                          name={m.user.name}
                          avatarUrl={m.user.avatarUrl}
                          size="md"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-[13px] font-medium text-[#20232B]">
                              {m.user.name}
                            </p>
                            {m.user.department?.name && (
                              <span className="rounded-[4px] border border-[#EAECF0] bg-[#F7F8FA] px-1.5 py-0.5 text-[10.5px] font-medium text-[#525866]">
                                {m.user.department.name}
                              </span>
                            )}
                          </div>
                          <p className="truncate text-xs text-[#737987]">
                            {m.user.designation
                              ? `${m.user.designation} · ${m.user.email}`
                              : m.user.email}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0">
                        <span className="rounded-[5px] border border-[#EAECF0] bg-[#F7F8FA] px-2 py-0.5 text-[11px] font-medium text-[#4B5563]">
                          {m.role}
                        </span>
                        <RoleBadge role={m.user.role} />
                        {canManage && m.user.id !== project.managerId && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-[#737987] hover:text-red-600 hover:bg-red-50"
                            onClick={() => handleRemoveMember(m.user.id)}
                            title="Remove from project"
                          >
                            <UserMinus className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="activity">
          <RecentActivityCard
            activities={activities}
            title="Project Activity"
            subtitle="Filter updates by category, team member, or keyword"
            showProjectFilter={false}
            pageSize={10}
            className="max-w-3xl"
          />
        </TabsContent>
      </Tabs>

      {canManage && (
        <ProjectFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          users={allUsers}
          departments={departments}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          editingProject={project}
        />
      )}
    </div>
  );
}
