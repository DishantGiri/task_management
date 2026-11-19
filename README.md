# Meridian — Company Work Management System

Full-stack enterprise work management platform built with Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, Prisma, MySQL, Auth.js (NextAuth v5), Recharts, and dnd-kit.

## Features

- **Authentication & Role-Based Access Control (RBAC)** — Server-enforced permissions for `ADMIN`, `MANAGER`, and `EMPLOYEE` roles with secure bcrypt password hashing and Auth.js JWT sessions.
- **Company Overview Dashboard** — Real-time MySQL-backed KPIs, 7-day throughput chart, status distribution donut, project progress, upcoming deadlines, team workload, and activity feed.
- **Project Management & Dedicated Workspaces** — Create and manage projects with custom color codes, leads, members, timelines, and dedicated per-project workspaces (`/projects/[id]`).
- **Tasks & Nested Subtasks** — Human-readable task keys (`WEB-1`), assignees, multiple collaborators, priorities, statuses, start/due dates, tags, dependencies, and nested subtasks with automatic parent progress calculation.
- **5 Task Views** — Kanban Board (drag-and-drop with `@dnd-kit`), expandable List View with pagination, My Tasks (Today / Upcoming / Overdue / Completed), Monthly & Weekly Calendar View, and Gantt Timeline View with dependency indicators.
- **Collaboration & Notifications** — Task comments with `@mentions`, secure file attachments (upload/download/delete), activity audit logs, and near-real-time in-app notifications including assignment, mention, and upcoming deadline alerts.
- **Employee Management & Reports** — Organization directory, department & tag administration, workload tracking, Recharts analytics, and CSV report export.

## Demo Accounts

All seeded demo accounts use password `Password123!`:

| Role | Email |
| :--- | :--- |
| Admin | `admin@meridian.io` |
| Manager | `sarah@meridian.io` |
| Employee | `alex@meridian.io` |

## Getting Started

1. Configure `.env` with your MySQL connection string (`DATABASE_URL`).
2. Push schema and seed database:
   ```bash
   npx prisma db push
   npm run db:seed
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
# task_management
