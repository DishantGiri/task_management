import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const rawUrl =
  process.env.DATABASE_URL || "mysql://root:@127.0.0.1:3306/meridian_work";
const parsed = new URL(rawUrl);

const adapter = new PrismaMariaDb({
  host: parsed.hostname || "127.0.0.1",
  port: parsed.port ? parseInt(parsed.port, 10) : 3306,
  user: decodeURIComponent(parsed.username || "root"),
  password: decodeURIComponent(parsed.password || ""),
  database: parsed.pathname.replace(/^\//, "") || "meridian_work",
  connectionLimit: 5,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: "dishantgiri@fishtailinfosolutions.com" },
    update: {
      role: "ADMIN",
      status: "ACTIVE",
    },
    create: {
      name: "Dishant Giri",
      email: "dishantgiri@fishtailinfosolutions.com",
      passwordHash: "",
      role: "ADMIN",
      status: "ACTIVE",
      designation: "Administrator",
    },
  });

  console.log(
    `Production Admin seeded: ${admin.name} <${admin.email}> (${admin.role})`
  );
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
