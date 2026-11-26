import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

function createAdapter() {
  const rawUrl =
    process.env.DATABASE_URL ||
    "mysql://root:vanxunipaxi@127.0.0.1:3306/meridian_work";
  const parsed = new URL(rawUrl);

  return new PrismaMariaDb({
    host: parsed.hostname || "127.0.0.1",
    port: parsed.port ? parseInt(parsed.port, 10) : 3306,
    user: decodeURIComponent(parsed.username || "root"),
    password: decodeURIComponent(parsed.password || ""),
    database: parsed.pathname.replace(/^\//, "") || "meridian_work",
    connectionLimit: 10,
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const cachedPrisma =
  globalForPrisma.prisma &&
  "milestone" in globalForPrisma.prisma &&
  "projectPost" in globalForPrisma.prisma &&
  "personalNote" in globalForPrisma.prisma &&
  "personalNoteShare" in globalForPrisma.prisma &&
  "stickyNote" in globalForPrisma.prisma
    ? globalForPrisma.prisma
    : undefined;

export const prisma =
  cachedPrisma ??
  new PrismaClient({
    adapter: createAdapter(),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
