import { Suspense } from "react";
import { redirect } from "next/navigation";
import { startOfDay } from "date-fns";
import type { Prisma, Role, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/permissions";
import { TeamClient } from "@/components/employees/team-client";
import { Skeleton } from "@/components/ui/skeleton";

const PAGE_SIZE = 10;

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    q?: string;
    dept?: string;
    role?: string;
    status?: string;
  }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?reauth=1");

  const params = await searchParams;
  const requestedPage = Math.max(1, parseInt(params.page || "1", 10) || 1);
  const q = params.q?.trim() || "";
  const dept = params.dept || "ALL";
  const role = params.role || "ALL";
  const status = params.status || "ALL";

  const isAdmin = user.role === "ADMIN";
  const where: Prisma.UserWhereInput = {};
  if (!isAdmin) {
    // Non-admins only see active approved teammates (never pending/deactivated accounts)
    where.status = "ACTIVE";
  } else if (status !== "ALL") {
    where.status = status as UserStatus;
  }
  if (dept !== "ALL") where.departmentId = dept;
  if (role !== "ALL") where.role = role as Role;
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { email: { contains: q } },
      { designation: { contains: q } },
    ];
  }

  const userInclude = {
    department: { select: { id: true, name: true } },
    assignedTasks: {
      where: { parentId: null },
      select: { id: true, status: true, dueDate: true },
    },
    _count: {
      select: { projectMemberships: true },
    },
  } as const;

  const [
    pagedUsers,
    filteredTotal,
    totalUsers,
    activeCount,
    pendingCount,
    managersCount,
    pendingUsers,
    departments,
  ] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: [{ status: "asc" }, { name: "asc" }],
      skip: (requestedPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: userInclude,
    }),
    prisma.user.count({ where }),
    prisma.user.count(),
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.user.count({ where: { status: { in: ["PENDING", "INVITED"] } } }),
    prisma.user.count({ where: { role: { in: ["ADMIN", "MANAGER"] } } }),
    user.role === "ADMIN"
      ? prisma.user.findMany({
          where: { status: { in: ["PENDING", "INVITED"] } },
          orderBy: { createdAt: "desc" },
          include: userInclude,
        })
      : Promise.resolve([]),
    prisma.department.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const todayStart = startOfDay(new Date());

  const serializeUser = (u: (typeof pagedUsers)[number]) => {
    const totalTasks = u.assignedTasks.length;
    const completedTasks = u.assignedTasks.filter(
      (t) => t.status === "DONE"
    ).length;
    const activeTasks = totalTasks - completedTasks;
    const overdueTasks = u.assignedTasks.filter(
      (t) => t.status !== "DONE" && t.dueDate && t.dueDate < todayStart
    ).length;

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      avatarUrl: u.avatarUrl,
      designation: u.designation,
      role: u.role,
      status: u.status,
      departmentId: u.departmentId,
      department: u.department,
      createdAt: u.createdAt.toISOString(),
      stats: {
        totalTasks,
        completedTasks,
        activeTasks,
        overdueTasks,
        projectCount: u._count.projectMemberships,
      },
    };
  };

  return (
    <Suspense fallback={<Skeleton className="h-[500px] w-full" />}>
      <TeamClient
        employees={pagedUsers.map(serializeUser)}
        pendingEmployees={pendingUsers.map(serializeUser)}
        departments={departments}
        currentUserId={user.id}
        currentUserRole={user.role}
        serverPagination={{
          page: requestedPage,
          pageSize: PAGE_SIZE,
          totalItems: filteredTotal,
          summary: {
            totalUsers,
            activeCount,
            pendingCount,
            managersCount,
          },
          filters: { q, dept, role, status },
        }}
      />
    </Suspense>
  );
}
