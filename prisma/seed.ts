import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { addDays, subDays } from "date-fns";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Meridian Work Management database...");

  const passwordHash = await bcrypt.hash("Password123!", 12);

  // 1. Departments
  const deptEngineering = await prisma.department.upsert({
    where: { name: "Engineering" },
    update: {},
    create: {
      name: "Engineering",
      description: "Core product engineering, web platform, and infrastructure teams.",
    },
  });

  const deptDesign = await prisma.department.upsert({
    where: { name: "Product Design" },
    update: {},
    create: {
      name: "Product Design",
      description: "UX research, design systems, and brand experience.",
    },
  });

  const deptOperations = await prisma.department.upsert({
    where: { name: "Operations" },
    update: {},
    create: {
      name: "Operations",
      description: "Business operations, IT security, and program delivery.",
    },
  });

  const deptMarketing = await prisma.department.upsert({
    where: { name: "Marketing" },
    update: {},
    create: {
      name: "Marketing",
      description: "Growth marketing, product launches, and communications.",
    },
  });

  // 2. Users (Admin, Managers, Employees)
  const admin = await prisma.user.upsert({
    where: { email: "admin@meridian.io" },
    update: {},
    create: {
      name: "Elena Rostova",
      email: "admin@meridian.io",
      passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
      designation: "VP of Operations",
      departmentId: deptOperations.id,
    },
  });

  const managerSarah = await prisma.user.upsert({
    where: { email: "sarah@meridian.io" },
    update: {},
    create: {
      name: "Sarah Chen",
      email: "sarah@meridian.io",
      passwordHash,
      role: "MANAGER",
      status: "ACTIVE",
      designation: "Engineering Manager",
      departmentId: deptEngineering.id,
    },
  });

  const managerMarcus = await prisma.user.upsert({
    where: { email: "marcus@meridian.io" },
    update: {},
    create: {
      name: "Marcus Vance",
      email: "marcus@meridian.io",
      passwordHash,
      role: "MANAGER",
      status: "ACTIVE",
      designation: "Product Design Lead",
      departmentId: deptDesign.id,
    },
  });

  const empAlex = await prisma.user.upsert({
    where: { email: "alex@meridian.io" },
    update: {},
    create: {
      name: "Alex Rivera",
      email: "alex@meridian.io",
      passwordHash,
      role: "EMPLOYEE",
      status: "ACTIVE",
      designation: "Senior Frontend Engineer",
      departmentId: deptEngineering.id,
    },
  });

  const empPriya = await prisma.user.upsert({
    where: { email: "priya@meridian.io" },
    update: {},
    create: {
      name: "Priya Patel",
      email: "priya@meridian.io",
      passwordHash,
      role: "EMPLOYEE",
      status: "ACTIVE",
      designation: "Backend Engineer",
      departmentId: deptEngineering.id,
    },
  });

  const empDaniel = await prisma.user.upsert({
    where: { email: "daniel@meridian.io" },
    update: {},
    create: {
      name: "Daniel Kim",
      email: "daniel@meridian.io",
      passwordHash,
      role: "EMPLOYEE",
      status: "ACTIVE",
      designation: "Product Designer",
      departmentId: deptDesign.id,
    },
  });

  const empSofia = await prisma.user.upsert({
    where: { email: "sofia@meridian.io" },
    update: {},
    create: {
      name: "Sofia Morales",
      email: "sofia@meridian.io",
      passwordHash,
      role: "EMPLOYEE",
      status: "ACTIVE",
      designation: "QA Automation Engineer",
      departmentId: deptEngineering.id,
    },
  });

  const empLiam = await prisma.user.upsert({
    where: { email: "liam@meridian.io" },
    update: {},
    create: {
      name: "Liam O'Connor",
      email: "liam@meridian.io",
      passwordHash,
      role: "EMPLOYEE",
      status: "ACTIVE",
      designation: "Growth Strategist",
      departmentId: deptMarketing.id,
    },
  });

  // 3. Tags
  const tagFrontend = await prisma.tag.upsert({
    where: { name: "Frontend" },
    update: {},
    create: { name: "Frontend", color: "#635BDB" },
  });
  const tagBackend = await prisma.tag.upsert({
    where: { name: "Backend" },
    update: {},
    create: { name: "Backend", color: "#0EA5E9" },
  });
  const tagDesign = await prisma.tag.upsert({
    where: { name: "Design" },
    update: {},
    create: { name: "Design", color: "#EC4899" },
  });
  const tagQA = await prisma.tag.upsert({
    where: { name: "QA" },
    update: {},
    create: { name: "QA", color: "#16A34A" },
  });
  const tagSecurity = await prisma.tag.upsert({
    where: { name: "Security" },
    update: {},
    create: { name: "Security", color: "#EF4444" },
  });
  const tagRelease = await prisma.tag.upsert({
    where: { name: "Q4 Release" },
    update: {},
    create: { name: "Q4 Release", color: "#F59E0B" },
  });

  // Check if projects already exist to keep seed idempotent
  const existingProjects = await prisma.project.count();
  if (existingProjects > 0) {
    console.log("Projects already seeded, skipping task creation.");
    return;
  }

  const now = new Date();

  // 4. Projects
  const projWeb = await prisma.project.create({
    data: {
      code: "WEB",
      name: "Company Website",
      description:
        "Complete relaunch of the corporate marketing website with refreshed design system, faster performance, and enterprise lead capture.",
      color: "#635BDB",
      status: "ACTIVE",
      priority: "HIGH",
      startDate: subDays(now, 14),
      endDate: addDays(now, 24),
      managerId: managerSarah.id,
      members: {
        create: [
          { userId: managerSarah.id, role: "LEAD" },
          { userId: empAlex.id, role: "MEMBER" },
          { userId: empDaniel.id, role: "MEMBER" },
          { userId: empSofia.id, role: "MEMBER" },
          { userId: empLiam.id, role: "MEMBER" },
        ],
      },
    },
  });

  const projPlatform = await prisma.project.create({
    data: {
      code: "PLT",
      name: "Core Platform API v3",
      description:
        "Multi-region API modernization, rate limiting, webhook delivery reliability, and enterprise SSO integration.",
      color: "#0EA5E9",
      status: "ACTIVE",
      priority: "URGENT",
      startDate: subDays(now, 20),
      endDate: addDays(now, 35),
      managerId: managerSarah.id,
      members: {
        create: [
          { userId: managerSarah.id, role: "LEAD" },
          { userId: empPriya.id, role: "MEMBER" },
          { userId: empAlex.id, role: "MEMBER" },
          { userId: empSofia.id, role: "MEMBER" },
        ],
      },
    },
  });

  const projDesignSys = await prisma.project.create({
    data: {
      code: "DSN",
      name: "Design System 2.0",
      description:
        "Unified token architecture, accessible Figma & React component library, and interactive documentation site.",
      color: "#16A34A",
      status: "ACTIVE",
      priority: "MEDIUM",
      startDate: subDays(now, 10),
      endDate: addDays(now, 40),
      managerId: managerMarcus.id,
      members: {
        create: [
          { userId: managerMarcus.id, role: "LEAD" },
          { userId: empDaniel.id, role: "MEMBER" },
          { userId: empAlex.id, role: "MEMBER" },
        ],
      },
    },
  });

  const projLaunch = await prisma.project.create({
    data: {
      code: "MKT",
      name: "Q4 Enterprise Launch",
      description:
        "Go-to-market readiness including customer case studies, pricing page updates, and analyst briefing deck.",
      color: "#F59E0B",
      status: "PLANNING",
      priority: "HIGH",
      startDate: addDays(now, 2),
      endDate: addDays(now, 45),
      managerId: managerMarcus.id,
      members: {
        create: [
          { userId: managerMarcus.id, role: "LEAD" },
          { userId: empLiam.id, role: "MEMBER" },
          { userId: admin.id, role: "VIEWER" },
        ],
      },
    },
  });

  // 5. Tasks & Nested Subtasks
  // Project: Company Website -> Task: Develop Homepage (with 5 subtasks matching specification)
  const taskHomepage = await prisma.task.create({
    data: {
      taskKey: "WEB-1",
      title: "Develop Homepage",
      description:
        "Implement the flagship Meridian homepage based on the approved Figma prototypes. Must achieve 95+ Lighthouse performance and full keyboard accessibility.",
      status: "IN_PROGRESS",
      priority: "HIGH",
      position: 0,
      progress: 63,
      startDate: subDays(now, 7),
      dueDate: addDays(now, 3),
      projectId: projWeb.id,
      assigneeId: empAlex.id,
      creatorId: managerSarah.id,
      collaborators: {
        create: [{ userId: empDaniel.id }, { userId: empSofia.id }],
      },
      tags: {
        create: [{ tagId: tagFrontend.id }, { tagId: tagRelease.id }],
      },
    },
  });

  // 5 Subtasks for Develop Homepage
  const subNavbar = await prisma.task.create({
    data: {
      taskKey: "WEB-2",
      title: "Create navbar",
      description: "Build sticky navigation bar with product dropdown, pricing link, and mobile drawer.",
      status: "DONE",
      priority: "HIGH",
      position: 0,
      progress: 100,
      startDate: subDays(now, 7),
      dueDate: subDays(now, 4),
      completedAt: subDays(now, 4),
      projectId: projWeb.id,
      parentId: taskHomepage.id,
      assigneeId: empAlex.id,
      creatorId: managerSarah.id,
    },
  });

  const subHero = await prisma.task.create({
    data: {
      taskKey: "WEB-3",
      title: "Build hero section",
      description: "Implement hero headline, interactive product preview, and enterprise customer logos.",
      status: "DONE",
      priority: "HIGH",
      position: 1,
      progress: 100,
      startDate: subDays(now, 5),
      dueDate: subDays(now, 2),
      completedAt: subDays(now, 2),
      projectId: projWeb.id,
      parentId: taskHomepage.id,
      assigneeId: empAlex.id,
      creatorId: managerSarah.id,
    },
  });

  await prisma.task.create({
    data: {
      taskKey: "WEB-4",
      title: "Develop footer",
      description: "Create multi-column sitemap footer with newsletter signup and legal links.",
      status: "IN_REVIEW",
      priority: "MEDIUM",
      position: 2,
      progress: 75,
      startDate: subDays(now, 3),
      dueDate: addDays(now, 1),
      projectId: projWeb.id,
      parentId: taskHomepage.id,
      assigneeId: empDaniel.id,
      creatorId: managerSarah.id,
    },
  });

  await prisma.task.create({
    data: {
      taskKey: "WEB-5",
      title: "Make responsive",
      description: "Verify tablet and mobile breakpoints from 360px to 1440px and eliminate horizontal overflow.",
      status: "IN_PROGRESS",
      priority: "HIGH",
      position: 3,
      progress: 40,
      startDate: subDays(now, 1),
      dueDate: addDays(now, 2),
      projectId: projWeb.id,
      parentId: taskHomepage.id,
      assigneeId: empAlex.id,
      creatorId: managerSarah.id,
    },
  });

  await prisma.task.create({
    data: {
      taskKey: "WEB-6",
      title: "Test homepage",
      description: "Run cross-browser visual regression, accessibility audit, and Core Web Vitals checks.",
      status: "TODO",
      priority: "MEDIUM",
      position: 4,
      progress: 0,
      startDate: addDays(now, 1),
      dueDate: addDays(now, 3),
      projectId: projWeb.id,
      parentId: taskHomepage.id,
      assigneeId: empSofia.id,
      creatorId: managerSarah.id,
    },
  });

  const taskPricing = await prisma.task.create({
    data: {
      taskKey: "WEB-7",
      title: "Build interactive pricing calculator",
      description: "Seat-based annual/monthly billing toggle with enterprise custom quote request modal.",
      status: "TODO",
      priority: "MEDIUM",
      position: 0,
      progress: 0,
      startDate: addDays(now, 2),
      dueDate: addDays(now, 9),
      projectId: projWeb.id,
      assigneeId: empAlex.id,
      creatorId: managerSarah.id,
      collaborators: { create: [{ userId: empLiam.id }] },
      tags: { create: [{ tagId: tagFrontend.id }] },
    },
  });

  const taskSEO = await prisma.task.create({
    data: {
      taskKey: "WEB-8",
      title: "Technical SEO & structured data audit",
      description: "Add JSON-LD schema, dynamic OpenGraph images, and XML sitemap generation.",
      status: "IN_REVIEW",
      priority: "LOW",
      position: 0,
      progress: 75,
      startDate: subDays(now, 4),
      dueDate: now,
      projectId: projWeb.id,
      assigneeId: empLiam.id,
      creatorId: managerSarah.id,
      tags: { create: [{ tagId: tagRelease.id }] },
    },
  });

  const taskCopy = await prisma.task.create({
    data: {
      taskKey: "WEB-9",
      title: "Finalize customer proof points & testimonials",
      description: "Collect approved quotes and ROI metrics from 4 enterprise design partners.",
      status: "DONE",
      priority: "MEDIUM",
      position: 0,
      progress: 100,
      startDate: subDays(now, 10),
      dueDate: subDays(now, 3),
      completedAt: subDays(now, 4),
      projectId: projWeb.id,
      assigneeId: empLiam.id,
      creatorId: admin.id,
      tags: { create: [{ tagId: tagRelease.id }] },
    },
  });

  // Core Platform API v3 Tasks
  const taskAuth = await prisma.task.create({
    data: {
      taskKey: "PLT-1",
      title: "Implement SAML 2.0 & OIDC Enterprise SSO",
      description: "Add Okta and Azure AD identity provider onboarding with SCIM directory sync.",
      status: "IN_PROGRESS",
      priority: "URGENT",
      position: 1,
      progress: 50,
      startDate: subDays(now, 6),
      dueDate: addDays(now, 4),
      projectId: projPlatform.id,
      assigneeId: empPriya.id,
      creatorId: managerSarah.id,
      collaborators: { create: [{ userId: empSofia.id }] },
      tags: { create: [{ tagId: tagBackend.id }, { tagId: tagSecurity.id }] },
    },
  });

  await prisma.task.create({
    data: {
      taskKey: "PLT-2",
      title: "Configure SAML assertion verification",
      description: "Validate X.509 certificates, clock skew tolerance, and signature enforcement.",
      status: "DONE",
      priority: "URGENT",
      position: 0,
      progress: 100,
      startDate: subDays(now, 6),
      dueDate: subDays(now, 1),
      completedAt: subDays(now, 1),
      projectId: projPlatform.id,
      parentId: taskAuth.id,
      assigneeId: empPriya.id,
      creatorId: managerSarah.id,
    },
  });

  await prisma.task.create({
    data: {
      taskKey: "PLT-3",
      title: "Build SCIM user provisioning webhook",
      description: "Handle user creation, group membership updates, and automatic deprovisioning.",
      status: "TODO",
      priority: "HIGH",
      position: 1,
      progress: 0,
      startDate: now,
      dueDate: addDays(now, 4),
      projectId: projPlatform.id,
      parentId: taskAuth.id,
      assigneeId: empPriya.id,
      creatorId: managerSarah.id,
    },
  });

  const taskRateLimit = await prisma.task.create({
    data: {
      taskKey: "PLT-4",
      title: "Distributed rate limiting for public REST endpoints",
      description: "Implement sliding-window rate limiter with per-tenant quotas and Retry-After headers.",
      status: "IN_REVIEW",
      priority: "HIGH",
      position: 1,
      progress: 80,
      startDate: subDays(now, 8),
      dueDate: subDays(now, 1), // intentionally overdue for realistic dashboard metrics!
      projectId: projPlatform.id,
      assigneeId: empPriya.id,
      creatorId: managerSarah.id,
      tags: { create: [{ tagId: tagBackend.id }, { tagId: tagSecurity.id }] },
    },
  });

  const taskLoadTest = await prisma.task.create({
    data: {
      taskKey: "PLT-5",
      title: "Run k6 load tests at 10k req/sec",
      description: "Benchmark p95 latency and connection pool saturation under burst traffic.",
      status: "TODO",
      priority: "HIGH",
      position: 1,
      progress: 0,
      startDate: addDays(now, 4),
      dueDate: addDays(now, 11),
      projectId: projPlatform.id,
      assigneeId: empSofia.id,
      creatorId: managerSarah.id,
      tags: { create: [{ tagId: tagQA.id }, { tagId: tagBackend.id }] },
    },
  });

  // Design System 2.0 Tasks
  const taskTokens = await prisma.task.create({
    data: {
      taskKey: "DSN-1",
      title: "Publish semantic color & spacing tokens",
      description: "Standardize neutral grays, focus rings, and 4px spacing scale across Figma and CSS variables.",
      status: "DONE",
      priority: "HIGH",
      position: 1,
      progress: 100,
      startDate: subDays(now, 10),
      dueDate: subDays(now, 4),
      completedAt: subDays(now, 5),
      projectId: projDesignSys.id,
      assigneeId: empDaniel.id,
      creatorId: managerMarcus.id,
      tags: { create: [{ tagId: tagDesign.id }] },
    },
  });

  const taskDataTable = await prisma.task.create({
    data: {
      taskKey: "DSN-2",
      title: "Design dense data table & filter bar specs",
      description: "Define row heights, sticky headers, bulk selection, and empty states for B2B tables.",
      status: "IN_PROGRESS",
      priority: "MEDIUM",
      position: 2,
      progress: 40,
      startDate: subDays(now, 3),
      dueDate: addDays(now, 5),
      projectId: projDesignSys.id,
      assigneeId: empDaniel.id,
      creatorId: managerMarcus.id,
      collaborators: { create: [{ userId: empAlex.id }] },
      tags: { create: [{ tagId: tagDesign.id }, { tagId: tagFrontend.id }] },
    },
  });

  // Q4 Launch Task
  await prisma.task.create({
    data: {
      taskKey: "MKT-1",
      title: "Draft Q4 enterprise release announcement",
      description: "Prepare press brief, changelog highlights, and customer webinar talking points.",
      status: "TODO",
      priority: "HIGH",
      position: 2,
      progress: 0,
      startDate: addDays(now, 3),
      dueDate: addDays(now, 12),
      projectId: projLaunch.id,
      assigneeId: empLiam.id,
      creatorId: managerMarcus.id,
      tags: { create: [{ tagId: tagRelease.id }] },
    },
  });

  // 6. Task Dependencies (for Timeline view!)
  await prisma.taskDependency.createMany({
    data: [
      { taskId: taskPricing.id, dependsOnId: taskHomepage.id },
      { taskId: taskLoadTest.id, dependsOnId: taskRateLimit.id },
      { taskId: taskDataTable.id, dependsOnId: taskTokens.id },
    ],
  });

  // 7. Comments
  await prisma.comment.createMany({
    data: [
      {
        taskId: taskHomepage.id,
        authorId: managerSarah.id,
        content:
          "Great velocity on the navbar and hero section @Alex! Let's prioritize responsive QA before Friday's stakeholder walkthrough.",
        createdAt: subDays(now, 1),
      },
      {
        taskId: taskHomepage.id,
        authorId: empAlex.id,
        content:
          "Navbar and hero are merged into staging. Working through tablet grid refinements with @Daniel now.",
        createdAt: subDays(now, 0),
      },
      {
        taskId: taskAuth.id,
        authorId: empPriya.id,
        content:
          "SAML assertion validation passed against Okta sandbox. Starting SCIM webhook endpoints next.",
        createdAt: subDays(now, 1),
      },
    ],
  });

  // 8. Activity Logs
  await prisma.activityLog.createMany({
    data: [
      {
        action: "PROJECT_CREATED",
        entityType: "PROJECT",
        entityId: projWeb.id,
        description: "created project Company Website (WEB)",
        actorId: admin.id,
        projectId: projWeb.id,
        createdAt: subDays(now, 14),
      },
      {
        action: "TASK_CREATED",
        entityType: "TASK",
        entityId: taskHomepage.id,
        description: "created task WEB-1: Develop Homepage",
        actorId: managerSarah.id,
        projectId: projWeb.id,
        taskId: taskHomepage.id,
        createdAt: subDays(now, 7),
      },
      {
        action: "STATUS_CHANGED",
        entityType: "TASK",
        entityId: subNavbar.id,
        description: "marked subtask WEB-2 (Create navbar) as Done",
        actorId: empAlex.id,
        projectId: projWeb.id,
        taskId: taskHomepage.id,
        createdAt: subDays(now, 4),
      },
      {
        action: "STATUS_CHANGED",
        entityType: "TASK",
        entityId: subHero.id,
        description: "marked subtask WEB-3 (Build hero section) as Done",
        actorId: empAlex.id,
        projectId: projWeb.id,
        taskId: taskHomepage.id,
        createdAt: subDays(now, 2),
      },
      {
        action: "STATUS_CHANGED",
        entityType: "TASK",
        entityId: taskRateLimit.id,
        description: "moved PLT-4 (Distributed rate limiting) to In Review",
        actorId: empPriya.id,
        projectId: projPlatform.id,
        taskId: taskRateLimit.id,
        createdAt: subDays(now, 1),
      },
      {
        action: "COMMENT_ADDED",
        entityType: "TASK",
        entityId: taskHomepage.id,
        description: "commented on WEB-1: Develop Homepage",
        actorId: empAlex.id,
        projectId: projWeb.id,
        taskId: taskHomepage.id,
        createdAt: now,
      },
      {
        action: "STATUS_CHANGED",
        entityType: "TASK",
        entityId: taskCopy.id,
        description: "completed WEB-9: Finalize customer proof points & testimonials",
        actorId: empLiam.id,
        projectId: projWeb.id,
        taskId: taskCopy.id,
        createdAt: subDays(now, 3),
      },
    ],
  });

  // 9. Notifications
  await prisma.notification.createMany({
    data: [
      {
        userId: admin.id,
        actorId: empPriya.id,
        type: "TASK_UPDATED",
        title: "PLT-4 ready for review",
        message: "Priya Patel moved Distributed rate limiting for public REST endpoints to In Review.",
        link: `/tasks?taskId=${taskRateLimit.id}`,
        taskId: taskRateLimit.id,
        isRead: false,
      },
      {
        userId: admin.id,
        actorId: empAlex.id,
        type: "COMMENT_ADDED",
        title: "New comment on WEB-1",
        message: "Alex Rivera updated progress on Develop Homepage (63% complete).",
        link: `/tasks?taskId=${taskHomepage.id}`,
        taskId: taskHomepage.id,
        isRead: false,
      },
      {
        userId: empAlex.id,
        actorId: managerSarah.id,
        type: "MENTION",
        title: "Sarah Chen mentioned you in WEB-1",
        message: "Great velocity on the navbar and hero section @Alex!",
        link: `/tasks?taskId=${taskHomepage.id}`,
        taskId: taskHomepage.id,
        isRead: false,
      },
      {
        userId: managerSarah.id,
        actorId: empLiam.id,
        type: "TASK_UPDATED",
        title: "WEB-8 submitted for review",
        message: "Liam O'Connor moved Technical SEO & structured data audit to In Review.",
        link: `/tasks?taskId=${taskSEO.id}`,
        taskId: taskSEO.id,
        isRead: false,
      },
    ],
  });

  console.log("Seed completed successfully!");
  console.log("Demo accounts (all use Password123!):");
  console.log("  Admin:    admin@meridian.io");
  console.log("  Manager:  sarah@meridian.io");
  console.log("  Employee: alex@meridian.io");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
