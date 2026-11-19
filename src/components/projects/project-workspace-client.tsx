"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  Calendar,
  ListTodo,
  Pencil,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import type { ProjectMemberRole, Role } from "@prisma/client";
import type {
  ProjectListItem,
  TagSummary,
  TaskListItem,
  UserSummary,
} from "@/types";
import {
  addProjectMemberAction,
  removeProjectMemberAction,
} from "@/actions/projects";
import { formatRelativeTime, formatShortDate } from "@/lib/utils";
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
  allUsers,
  tags,
  activities,
  currentUserId,
  currentUserRole,
  canManage,
}: {
  project: ProjectListItem;
  tasks: TaskListItem[];
  allUsers: UserSummary[];
  tags: TagSummary[];
  activities: ProjectActivityItem[];
  currentUserId: string;
  currentUserRole: Role;
  canManage: boolean;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState<ProjectMemberRole>("MEMBER");
  const [addingMember, setAddingMember] = useState(false);

  const memberUserIds = new Set(project.members.map((m) => m.user.id));
  const nonMembers = allUsers.filter((u) => !memberUserIds.has(u.id));

  const handleAddMember = async () => {
    if (!selectedUserId) return;
    setAddingMember(true);
    const res = await addProjectMemberAction(
      project.id,
      selectedUserId,
      selectedRole
    );
    setAddingMember(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Member added to project");
    setSelectedUserId("");
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
      <div className="rounded-lg border border-[#EAECF0] bg-white p-5 shadow-subtle">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
              style={{ backgroundColor: project.color }}
            >
              {project.code.slice(0, 3)}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[22px] font-semibold tracking-tight text-[#20232B]">
                  {project.name}
                </h1>
                <span className="font-mono text-xs text-[#9CA3AF]">
                  {project.code}
                </span>
                <ProjectStatusBadge status={project.status} />
                <PriorityBadge priority={project.priority} />
              </div>
              {project.description && (
                <p className="mt-1.5 max-w-3xl text-[13px] text-[#525866] leading-relaxed">
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
                  Lead: <strong className="text-[#20232B]">{project.manager.name}</strong>
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
          <TabsTrigger value="members" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Members ({project.members.length})
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-1.5">
            <Activity className="h-3.5 w-3.5" />
            Activity ({activities.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tasks">
          <Suspense fallback={<Skeleton className="h-[460px] w-full" />}>
            <TasksWorkspace
              initialTasks={tasks}
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
              fixedProjectId={project.id}
              defaultView="kanban"
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="members">
          <div className="space-y-4 max-w-3xl">
            {canManage && nonMembers.length > 0 && (
              <div className="flex flex-wrap items-center gap-2.5 rounded-lg border border-[#EAECF0] bg-white p-3.5 shadow-subtle">
                <Select
                  value={selectedUserId}
                  onValueChange={setSelectedUserId}
                >
                  <SelectTrigger className="h-8 flex-1 min-w-[200px] text-xs">
                    <SelectValue placeholder="Select employee to add..." />
                  </SelectTrigger>
                  <SelectContent>
                    {nonMembers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name} — {u.designation || u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={selectedRole}
                  onValueChange={(v) =>
                    setSelectedRole(v as ProjectMemberRole)
                  }
                >
                  <SelectTrigger className="h-8 w-[125px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LEAD">Project Lead</SelectItem>
                    <SelectItem value="MEMBER">Member</SelectItem>
                    <SelectItem value="VIEWER">Viewer</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  size="sm"
                  className="h-8"
                  disabled={!selectedUserId || addingMember}
                  onClick={handleAddMember}
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Add Member
                </Button>
              </div>
            )}

            <div className="divide-y divide-[#EAECF0] rounded-lg border border-[#EAECF0] bg-white shadow-subtle">
              {project.members.map((m) => (
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
                      <p className="truncate text-[13px] font-medium text-[#20232B]">
                        {m.user.name}
                      </p>
                      <p className="truncate text-xs text-[#737987]">
                        {m.user.designation || m.user.email}
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
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="activity">
          <div className="max-w-3xl divide-y divide-[#EAECF0] rounded-lg border border-[#EAECF0] bg-white shadow-subtle">
            {activities.length === 0 ? (
              <p className="py-10 text-center text-xs text-[#737987]">
                No activity recorded in this project yet.
              </p>
            ) : (
              activities.map((act) => (
                <div
                  key={act.id}
                  className="flex items-start gap-3 px-4 py-3 text-xs"
                >
                  <UserAvatar
                    name={act.actor.name}
                    avatarUrl={act.actor.avatarUrl}
                    size="sm"
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <p className="text-[13px] text-[#20232B]">
                      <span className="font-medium">{act.actor.name}</span>{" "}
                      <span className="text-[#525866]">{act.description}</span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#9CA3AF]">
                      {formatRelativeTime(act.createdAt)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {canManage && (
        <ProjectFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          users={allUsers}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          editingProject={project}
        />
      )}
    </div>
  );
}
