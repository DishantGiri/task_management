import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

if (process.env.NODE_ENV === "production") {
  dotenv.config({ path: ".env.production", override: true });
} else {
  dotenv.config({ path: ".env" });
  dotenv.config({ path: ".env.development", override: true });
  dotenv.config({ path: ".env.local", override: true });
}

const rawUrl =
  process.env.DATABASE_URL ||
  "mysql://root:@127.0.0.1:3306/meridian_work";
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
    name: "Development",
    description:
      "Software engineering, full-stack, frontend, backend, WordPress, UI/UX, and DevOps.",
  },
  {
    name: "SEO",
    description:
      "Search engine optimization, organic growth, analytics, and digital visibility.",
  },
  {
    name: "QA & Testing",
    description:
      "Quality assurance, automated and manual software testing, and release sign-off.",
  },
  {
    name: "Content & Video",
    description:
      "Content creation, video generation, creative media, and copywriting.",
  },
  {
    name: "Human Resources",
    description:
      "People operations, talent acquisition, onboarding, and employee culture.",
  },
  {
    name: "Management",
    description:
      "Executive leadership, project management, and company operations.",
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
