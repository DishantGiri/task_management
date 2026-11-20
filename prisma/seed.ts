import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const rawUrl =
  process.env.DATABASE_URL ||
  "mysql://root:vanxunipaxi@127.0.0.1:3306/meridian_work";
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

const DEPARTMENTS = [
  {
    name: "SEO",
    description: "Search engine optimization, organic growth, and content visibility.",
  },
  {
    name: "Video Generation",
    description: "Video production, AI video generation, and multimedia creative.",
  },
  {
    name: "Developement",
    description: "Software development, web applications, and engineering.",
  },
];

async function main() {
  for (const dept of DEPARTMENTS) {
    await prisma.department.upsert({
      where: { name: dept.name },
      update: { description: dept.description },
      create: {
        name: dept.name,
        description: dept.description,
      },
    });
  }

  console.log(
    `Departments seeded: ${DEPARTMENTS.map((d) => d.name).join(", ")}`
  );

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
