import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/permissions";
import { SettingsClient } from "@/components/settings/settings-client";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?reauth=1");

  const [departments, tags] = await Promise.all([
    prisma.department.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { users: true } } },
    }),
    prisma.tag.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { tasks: true } } },
    }),
  ]);

  return <SettingsClient user={user} departments={departments} tags={tags} />;
}
