import { redirect } from "next/navigation";
import { startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getAccessibleProjectIds, getCurrentUser } from "@/lib/permissions";
import { getProjectsList } from "@/lib/queries";
import { ReportsClient } from "@/components/dashboard/reports-client";

export default async function ReportsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?reauth=1");

  const accessibleProjectIds = await getAccessibleProjectIds(user);
  const projectFilter =
    accessibleProjectIds !== null ? { in: accessibleProjectIds } : undefined;

  const [tasks, projects, users, departments] = await Promise.all([
    prisma.task.findMany({
      where: {
        parentId: null,
        ...(projectFilter ? { projectId: projectFilter } : {}),
      },
      select: {
        id: true,
        status: true,
        priority: true,
        dueDate: true,
        completedAt: true,
        assigneeId: true,
      },
    }),
    getProjectsList(user),
    prisma.user.findMany({
      where: { status: { not: "INACTIVE" } },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        departmentId: true,
        assignedTasks: {
          where: {
            parentId: null,
            ...(projectFilter ? { projectId: projectFilter } : {}),
          },
          select: { id: true, status: true, dueDate: true },
        },
      },
    }),
    prisma.department.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const todayStart = startOfDay(new Date());
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === "DONE").length;
  const overdueTasks = tasks.filter(
    (t) => t.status !== "DONE" && t.dueDate && t.dueDate < todayStart
  ).length;

  const completedWithDue = tasks.filter(
    (t) => t.status === "DONE" && t.dueDate && t.completedAt
  );
  const onTimeCompleted = completedWithDue.filter(
    (t) => t.completedAt! <= t.dueDate!
  ).length;
  const onTimeRate =
    completedWithDue.length > 0
      ? Math.round((onTimeCompleted / completedWithDue.length) * 100)
      : completedTasks > 0
      ? 100
      : 0;

  const priorityBreakdown = [
    {
      name: "Urgent",
      count: tasks.filter((t) => t.priority === "URGENT").length,
      color: "#EF4444",
    },
    {
      name: "High",
      count: tasks.filter((t) => t.priority === "HIGH").length,
      color: "#F59E0B",
    },
    {
      name: "Medium",
      count: tasks.filter((t) => t.priority === "MEDIUM").length,
      color: "#3B82F6",
    },
    {
      name: "Low",
      count: tasks.filter((t) => t.priority === "LOW").length,
      color: "#94A3B8",
    },
  ];

  const workloadData = users.slice(0, 8).map((u) => {
    const completed = u.assignedTasks.filter((t) => t.status === "DONE").length;
    const overdue = u.assignedTasks.filter(
      (t) => t.status !== "DONE" && t.dueDate && t.dueDate < todayStart
    ).length;
    const active = u.assignedTasks.length - completed;
    return {
      name: u.name.split(" ")[0],
      active,
      completed,
      overdue,
    };
  });

  const departmentStats = departments.map((d) => {
    const deptUsers = users.filter((u) => u.departmentId === d.id);
    const assigned = deptUsers.reduce(
      (acc, u) => acc + u.assignedTasks.length,
      0
    );
    const completed = deptUsers.reduce(
      (acc, u) =>
        acc + u.assignedTasks.filter((t) => t.status === "DONE").length,
      0
    );
    return {
      name: d.name,
      members: deptUsers.length,
      assigned,
      completed,
      rate: assigned > 0 ? Math.round((completed / assigned) * 100) : 0,
    };
  });

  return (
    <ReportsClient
      data={{
        summary: {
          totalTasks,
          completedTasks,
          overdueTasks,
          completionRate:
            totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
          onTimeRate,
          totalProjects: projects.length,
          activeEmployees: users.length,
        },
        priorityBreakdown,
        workloadData,
        departmentStats,
        projectScorecard: projects.map((p) => ({
          id: p.id,
          code: p.code,
          name: p.name,
          color: p.color,
          status: p.status,
          managerName: p.manager.name,
          totalTasks: p.taskStats.total,
          completedTasks: p.taskStats.completed,
          overdueTasks: p.taskStats.overdue,
          progress: p.taskStats.progress,
        })),
      }}
    />
  );
}
