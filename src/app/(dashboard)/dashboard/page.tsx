import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock,
  FolderKanban,
  ListTodo,
  Users,
} from "lucide-react";
import { getCurrentUser } from "@/lib/permissions";
import { getDashboardData } from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import {
  cn,
  formatCompactDate,
  formatRelativeTime,
  isTaskOverdue,
} from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { UserAvatar } from "@/components/ui/avatar";
import {
  PriorityBadge,
  ProjectStatusBadge,
  TaskStatusBadge,
} from "@/components/shared/badges";
import {
  TaskActivityChart,
  TaskStatusDonut,
} from "@/components/dashboard/dashboard-charts";
import { RecentActivityCard } from "@/components/dashboard/recent-activity-card";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?reauth=1");

  const [data, pendingApprovalCount] = await Promise.all([
    getDashboardData(user),
    user.role === "ADMIN"
      ? prisma.user.count({
          where: { status: { in: ["PENDING", "INVITED"] } },
        })
      : Promise.resolve(0),
  ]);

  const isAdmin = user.role === "ADMIN";
  const isEmployee = user.role === "EMPLOYEE";

  const kpis = [
    ...(!isEmployee
      ? [
          {
            label: isAdmin ? "Total Employees" : "Project Members",
            value: data.stats.totalEmployees,
            icon: Users,
            href: "/team",
            accent: "text-[#635BDB]",
          },
        ]
      : []),
    {
      label: isAdmin ? "Active Projects" : "My Active Projects",
      value: data.stats.activeProjects,
      icon: FolderKanban,
      href: "/projects",
      accent: "text-[#3B82F6]",
    },
    {
      label: isEmployee ? "My Tasks" : isAdmin ? "Total Tasks" : "Project Tasks",
      value: data.stats.totalTasks,
      icon: ListTodo,
      href: isEmployee ? "/tasks?scope=mine" : "/tasks",
      accent: "text-[#20232B]",
    },
    {
      label: "Completed",
      value: data.stats.completedTasks,
      sub: `${data.stats.completionRate}% rate`,
      icon: CheckCircle2,
      href: isEmployee ? "/tasks?scope=mine&status=DONE" : "/tasks?status=DONE",
      accent: "text-[#16A34A]",
    },
    {
      label: "Pending Tasks",
      value: data.stats.pendingTasks,
      icon: Clock,
      href: isEmployee ? "/tasks?scope=mine" : "/tasks",
      accent: "text-[#F59E0B]",
    },
    {
      label: "Overdue",
      value: data.stats.overdueTasks,
      icon: AlertTriangle,
      href: isEmployee ? "/tasks?scope=mine" : "/tasks",
      accent: data.stats.overdueTasks > 0 ? "text-[#EF4444]" : "text-[#737987]",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Admin Alert Banner for Pending Google Logins On Hold */}
      {user.role === "ADMIN" && pendingApprovalCount > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-xs shadow-subtle">
          <div className="flex items-center gap-2.5">
            <Clock className="h-4 w-4 shrink-0 text-[#F59E0B]" />
            <span className="text-[#20232B]">
              <strong>
                {pendingApprovalCount}{" "}
                {pendingApprovalCount === 1
                  ? "employee account is"
                  : "employee accounts are"}{" "}
                on hold
              </strong>{" "}
              awaiting your approval and role assignment after Google sign-in.
            </span>
          </div>
          <Link
            href="/team?status=PENDING"
            className="inline-flex h-7 items-center gap-1.5 rounded-md bg-[#20232B] px-3 text-xs font-medium text-white hover:bg-[#374151] shrink-0"
          >
            Review &amp; Assign Roles
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight text-[#20232B]">
            {isAdmin
              ? "Company Overview"
              : isEmployee
              ? "My Overview"
              : "Projects Overview"}
          </h1>
          <p className="text-[13px] text-[#737987] mt-0.5">
            Welcome back, {user.name.split(" ")[0]}.{" "}
            {isAdmin
              ? "Here is live delivery status across the entire company."
              : isEmployee
              ? "Here is your personal work progress and upcoming deadlines."
              : "Here is live delivery status across your assigned projects."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/tasks?scope=mine"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#EAECF0] bg-white px-3 text-xs font-medium text-[#20232B] hover:bg-[#F7F8FA] transition-colors"
          >
            My Tasks
            <ArrowRight className="h-3.5 w-3.5 text-[#737987]" />
          </Link>
          {!isEmployee && (
            <Link
              href="/reports"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#EAECF0] bg-white px-3 text-xs font-medium text-[#20232B] hover:bg-[#F7F8FA] transition-colors"
            >
              {isAdmin ? "Full Reports" : "Project Reports"}
            </Link>
          )}
        </div>
      </div>

      {/* Compact KPI Strip */}
      <div
        className={cn(
          "grid grid-cols-2 md:grid-cols-3 gap-3",
          isEmployee ? "xl:grid-cols-5" : "xl:grid-cols-6"
        )}
      >
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Link
              key={kpi.label}
              href={kpi.href}
              className="group rounded-lg border border-[#EAECF0] bg-white p-4 shadow-subtle transition-colors hover:border-[#D5D9E2]"
            >
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-medium text-[#737987]">
                  {kpi.label}
                </span>
                <Icon className={cn("h-4 w-4", kpi.accent)} />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-[22px] font-semibold tracking-tight text-[#20232B]">
                  {kpi.value}
                </span>
                {kpi.sub && (
                  <span className="text-[11px] font-medium text-[#16A34A]">
                    {kpi.sub}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <Card className="lg:col-span-7">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle>Task Throughput (7 Days)</CardTitle>
              <p className="text-xs text-[#737987] mt-0.5">
                Tasks created vs. completed across projects
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-[#737987]">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-[2px] bg-[#C7C4F8]" />
                Created
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-[2px] bg-[#635BDB]" />
                Completed
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <TaskActivityChart data={data.trendData} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader className="pb-2">
            <CardTitle>Task Status Distribution</CardTitle>
            <p className="text-xs text-[#737987] mt-0.5">
              Breakdown by workflow stage
            </p>
          </CardHeader>
          <CardContent className="pt-2">
            <TaskStatusDonut data={data.statusDistribution} />
          </CardContent>
        </Card>
      </div>

      {/* Project Progress + Upcoming Deadlines */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Project Progress */}
        <Card className="lg:col-span-7">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle>Project Progress</CardTitle>
              <p className="text-xs text-[#737987] mt-0.5">
                Completion health and active milestones
              </p>
            </div>
            <Link
              href="/projects"
              className="text-xs font-medium text-[#635BDB] hover:text-[#5148C9]"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {data.projects.length === 0 ? (
              <p className="px-5 py-8 text-center text-xs text-[#737987]">
                No projects yet. Create your first project to begin tracking.
              </p>
            ) : (
              <div className="divide-y divide-[#EAECF0] border-t border-[#EAECF0]">
                {data.projects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-3.5 hover:bg-[#F7F8FA] transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                          style={{ backgroundColor: project.color }}
                        />
                        <span className="truncate text-[13px] font-medium text-[#20232B]">
                          {project.name}
                        </span>
                        <span className="font-mono text-[11px] text-[#9CA3AF]">
                          {project.code}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-[11.5px] text-[#737987]">
                        <span>Lead: {project.manager.name}</span>
                        <span>
                          {project.taskStats.completed}/{project.taskStats.total} tasks
                        </span>
                        {project.taskStats.overdue > 0 && (
                          <span className="text-[#EF4444] font-medium">
                            {project.taskStats.overdue} overdue
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 sm:w-56 shrink-0">
                      <ProjectStatusBadge status={project.status} />
                      <div className="flex-1 min-w-[70px]">
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="text-[#737987]">Progress</span>
                          <span className="font-medium text-[#20232B]">
                            {project.taskStats.progress}%
                          </span>
                        </div>
                        <Progress value={project.taskStats.progress} />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Deadlines */}
        <Card className="lg:col-span-5">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-[#635BDB]" />
              <div>
                <CardTitle>Upcoming Deadlines</CardTitle>
                <p className="text-xs text-[#737987] mt-0.5">
                  Soonest due and overdue items
                </p>
              </div>
            </div>
            <Link
              href="/calendar"
              className="text-xs font-medium text-[#635BDB] hover:text-[#5148C9]"
            >
              Calendar
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {data.upcomingTasks.length === 0 ? (
              <p className="px-5 py-8 text-center text-xs text-[#737987]">
                No upcoming deadlines scheduled.
              </p>
            ) : (
              <div className="divide-y divide-[#EAECF0] border-t border-[#EAECF0]">
                {data.upcomingTasks.map((task) => {
                  const overdue = isTaskOverdue(task.dueDate, task.status);
                  return (
                    <Link
                      key={task.id}
                      href={`/tasks?taskId=${task.id}`}
                      className="flex items-center justify-between gap-3 px-5 py-2.5 hover:bg-[#F7F8FA] transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[11px] text-[#737987]">
                            {task.taskKey}
                          </span>
                          <span className="truncate text-[13px] font-medium text-[#20232B]">
                            {task.title}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <TaskStatusBadge status={task.status} compact />
                          <PriorityBadge priority={task.priority} showLabel={false} />
                          <span className="text-[11px] text-[#737987] truncate">
                            {task.project.name}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={cn(
                            "text-[11.5px] font-medium",
                            overdue ? "text-[#EF4444]" : "text-[#737987]"
                          )}
                        >
                          {formatCompactDate(task.dueDate)}
                        </span>
                        {task.assignee && (
                          <UserAvatar
                            name={task.assignee.name}
                            avatarUrl={task.assignee.avatarUrl}
                            size="xs"
                          />
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Team Workload + Recent Activity (Admin & Manager only — hidden for Employees) */}
      {user.role !== "EMPLOYEE" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Employee Workload */}
          <Card className="lg:col-span-6">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle>
                  {isAdmin ? "Employee Workload" : "Project Team Workload"}
                </CardTitle>
                <p className="text-xs text-[#737987] mt-0.5">
                  {isAdmin
                    ? "Active vs. completed assignments per team member"
                    : "Assignments across your project team members"}
                </p>
              </div>
              {isAdmin && (
                <Link
                  href="/team"
                  className="text-xs font-medium text-[#635BDB] hover:text-[#5148C9]"
                >
                  Manage team
                </Link>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-[#EAECF0] border-t border-[#EAECF0]">
                {data.workload.map((member) => {
                  const pct =
                    member.total > 0
                      ? Math.round((member.done / member.total) * 100)
                      : 0;
                  return (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 px-5 py-3"
                    >
                      <UserAvatar
                        name={member.name}
                        avatarUrl={member.avatarUrl}
                        size="md"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-[13px] font-medium text-[#20232B]">
                            {member.name}
                          </p>
                          <div className="flex items-center gap-2 text-[11px] shrink-0">
                            <span className="text-[#4B5563] font-medium">
                              {member.active} active
                            </span>
                            <span className="text-[#16A34A]">
                              {member.done} done
                            </span>
                            {member.overdue > 0 && (
                              <span className="text-[#EF4444] font-medium">
                                {member.overdue} overdue
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="mt-1.5 flex items-center gap-2.5">
                          <Progress value={pct} className="h-1.5 flex-1" />
                          <span className="text-[11px] text-[#737987] w-20 truncate text-right">
                            {member.department}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity with Filters & Pagination */}
          <RecentActivityCard
            activities={data.recentActivities}
            className="lg:col-span-6"
          />
        </div>
      )}
    </div>
  );
}
