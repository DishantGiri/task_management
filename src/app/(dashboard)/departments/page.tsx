import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/permissions";
import { DepartmentsClient } from "@/components/employees/departments-client";

export default async function DepartmentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?reauth=1");

  const [departments, employees] = await Promise.all([
    prisma.department.findMany({
      orderBy: { name: "asc" },
      include: {
        users: {
          where: { status: { not: "INACTIVE" } },
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            designation: true,
            role: true,
          },
        },
      },
    }),
    prisma.user.findMany({
      where: { status: { not: "INACTIVE" } },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        designation: true,
        role: true,
        departmentId: true,
        department: { select: { name: true } },
      },
    }),
  ]);

  return (
    <DepartmentsClient
      departments={departments.map((d) => ({
        id: d.id,
        name: d.name,
        description: d.description,
        createdAt: d.createdAt.toISOString(),
        users: d.users,
      }))}
      allEmployees={employees.map((e) => ({
        id: e.id,
        name: e.name,
        email: e.email,
        avatarUrl: e.avatarUrl,
        designation: e.designation,
        role: e.role,
        departmentId: e.departmentId,
        departmentName: e.department?.name ?? null,
      }))}
      currentUserRole={user.role}
    />
  );
}
