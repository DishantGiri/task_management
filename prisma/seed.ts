import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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
