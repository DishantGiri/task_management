import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

// Load .env.production when NODE_ENV=production, otherwise .env then .env.local
if (process.env.NODE_ENV === "production") {
  dotenv.config({ path: ".env.production", override: true });
} else {
  dotenv.config({ path: ".env" });
  dotenv.config({ path: ".env.local", override: true });
}

const SUPER_ADMIN_EMAIL = "dishantgiri@fishtailinfosolutions.com";

const rawUrl = process.env.DATABASE_URL;
if (!rawUrl) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const parsed = new URL(rawUrl);
const dbName = parsed.pathname.replace(/^\//, "");

const adapter = new PrismaMariaDb({
  host: parsed.hostname || "127.0.0.1",
  port: parsed.port ? parseInt(parsed.port, 10) : 3306,
  user: decodeURIComponent(parsed.username || "root"),
  password: decodeURIComponent(parsed.password || ""),
  database: dbName,
  connectionLimit: 5,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log(`Cleaning database "${dbName}" on ${parsed.hostname}...`);

  // Delete child / join tables first to satisfy foreign key constraints
  await prisma.personalNoteShare.deleteMany();
  await prisma.personalNote.deleteMany();
  await prisma.stickyNote.deleteMany();
  await prisma.personalTask.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.taskTag.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.taskDependency.deleteMany();
  await prisma.taskAssignee.deleteMany();
  // Delete subtasks before parent tasks
  await prisma.task.deleteMany({ where: { parentId: { not: null } } });
  await prisma.task.deleteMany();
  await prisma.milestone.deleteMany();
  await prisma.projectPost.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();

  // Detach admin from any department before clearing departments
  await prisma.user.updateMany({
    where: { email: SUPER_ADMIN_EMAIL },
    data: {
      departmentId: null,
      role: "ADMIN",
      status: "ACTIVE",
    },
  });

  // Delete all non-admin users
  const deletedUsers = await prisma.user.deleteMany({
    where: { email: { not: SUPER_ADMIN_EMAIL } },
  });

  // Clear all departments
  await prisma.department.deleteMany();

  // Ensure the super admin user exists
  const admin = await prisma.user.upsert({
    where: { email: SUPER_ADMIN_EMAIL },
    update: {
      role: "ADMIN",
      status: "ACTIVE",
      departmentId: null,
    },
    create: {
      email: SUPER_ADMIN_EMAIL,
      name: "Dishant Giri",
      passwordHash: "",
      role: "ADMIN",
      status: "ACTIVE",
      designation: "Administrator",
    },
    select: { id: true, name: true, email: true, role: true, status: true },
  });

  console.log(
    `Done! Removed ${deletedUsers.count} other user(s) and wiped all projects, tasks, notes, and departments.`
  );
  console.log("Kept Admin:", admin);
}

main()
  .catch((err) => {
    console.error("Failed to clean database:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
