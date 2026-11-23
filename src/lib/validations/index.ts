import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Please enter a valid work email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const registerSchema = z.object({
  name: z.string().min(2, "Full name must be at least 2 characters").max(100),
  email: z.string().email("Please enter a valid work email"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100),
  designation: z.string().max(100).optional(),
});

export const employeeCreateSchema = z.object({
  name: z.string().min(2, "Name is required").max(100),
  email: z.string().email("Valid email is required"),
  password: z.string().optional(),
  role: z.enum(["ADMIN", "MANAGER", "EMPLOYEE"]),
  status: z
    .enum(["ACTIVE", "PENDING", "INACTIVE", "INVITED"])
    .default("ACTIVE"),
  departmentId: z.string().nullable().optional(),
  designation: z.string().max(100).nullable().optional(),
  avatarUrl: z.string().url().or(z.literal("")).nullable().optional(),
});

export const employeeUpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2, "Name is required").max(100),
  email: z.string().email("Valid email is required"),
  role: z.enum(["ADMIN", "MANAGER", "EMPLOYEE"]),
  status: z.enum(["ACTIVE", "PENDING", "INACTIVE", "INVITED"]),
  departmentId: z.string().nullable().optional(),
  designation: z.string().max(100).nullable().optional(),
  avatarUrl: z.string().url().or(z.literal("")).nullable().optional(),
  password: z.string().min(8).or(z.literal("")).optional(),
});

function isNotPastDate(val: string | null | undefined): boolean {
  if (!val) return true;
  const todayStr = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
  return val.slice(0, 10) >= todayStr;
}

const projectBaseSchema = z.object({
  name: z.string().min(2, "Project name is required").max(120),
  code: z
    .string()
    .min(2, "Code must be 2–8 characters")
    .max(8, "Code must be 2–8 characters")
    .regex(/^[A-Za-z0-9]+$/, "Only letters and numbers allowed")
    .transform((v) => v.toUpperCase()),
  description: z.string().max(5000).nullable().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#635BDB"),
  status: z.enum(["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "ARCHIVED"]).default("ACTIVE"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  managerId: z.string().min(1, "Project manager is required"),
  startDate: z
    .string()
    .nullable()
    .optional()
    .refine(isNotPastDate, {
      message: "Start date cannot be in the past",
    }),
  endDate: z
    .string()
    .nullable()
    .optional()
    .refine(isNotPastDate, {
      message: "End date cannot be in the past",
    }),
  memberIds: z.array(z.string()).default([]),
});

export const projectCreateSchema = projectBaseSchema.refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return data.endDate.slice(0, 10) >= data.startDate.slice(0, 10);
    }
    return true;
  },
  {
    message: "End date cannot be earlier than start date",
    path: ["endDate"],
  }
);

export const projectUpdateSchema = projectBaseSchema
  .extend({
    id: z.string().min(1),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.endDate.slice(0, 10) >= data.startDate.slice(0, 10);
      }
      return true;
    },
    {
      message: "End date cannot be earlier than start date",
      path: ["endDate"],
    }
  );

export const taskCreateSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(2, "Title must be at least 2 characters")
      .max(200, "Title must be 200 characters or fewer"),
    description: z
      .string()
      .max(10000, "Description must be 10,000 characters or fewer")
      .nullable()
      .optional(),
    projectId: z.string().min(1, "Project is required"),
    parentId: z.string().nullable().optional(),
    status: z.enum(["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"]).default("TODO"),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
    assigneeId: z.string().nullable().optional(),
    collaboratorIds: z.array(z.string()).default([]),
    tagIds: z.array(z.string()).default([]),
    dependencyIds: z.array(z.string()).default([]),
    startDate: z
      .string()
      .nullable()
      .optional()
      .refine(isNotPastDate, {
        message: "Start date cannot be in the past",
      }),
    dueDate: z
      .string()
      .nullable()
      .optional()
      .refine(isNotPastDate, {
        message: "Due date cannot be in the past",
      }),
  })
  .refine(
    (data) => {
      if (data.startDate && data.dueDate) {
        return data.dueDate.slice(0, 10) >= data.startDate.slice(0, 10);
      }
      return true;
    },
    {
      message: "Due date cannot be earlier than start date",
      path: ["dueDate"],
    }
  );

export const taskUpdateSchema = z.object({
  id: z.string().min(1),
  title: z
    .string()
    .trim()
    .min(2, "Title must be at least 2 characters")
    .max(200, "Title must be 200 characters or fewer")
    .optional(),
  description: z
    .string()
    .max(10000, "Description must be 10,000 characters or fewer")
    .nullable()
    .optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  assigneeId: z.string().nullable().optional(),
  collaboratorIds: z.array(z.string()).optional(),
  tagIds: z.array(z.string()).optional(),
  dependencyIds: z.array(z.string()).optional(),
  startDate: z
    .string()
    .nullable()
    .optional()
    .refine(isNotPastDate, {
      message: "Start date cannot be in the past",
    }),
  dueDate: z.string().nullable().optional(),
  position: z.number().int().min(0).optional(),
});

export const commentCreateSchema = z.object({
  taskId: z.string().min(1),
  content: z.string().min(1, "Comment cannot be empty").max(5000),
});

export const departmentCreateSchema = z.object({
  name: z.string().min(2, "Department name is required").max(80),
  description: z.string().max(500).nullable().optional(),
  memberIds: z.array(z.string()).optional(),
});

export const departmentUpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2, "Department name is required").max(80),
  description: z.string().max(500).nullable().optional(),
  memberIds: z.array(z.string()).optional(),
});

export const tagCreateSchema = z.object({
  name: z.string().min(1, "Tag name is required").max(40),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#635BDB"),
});

export const profileUpdateSchema = z.object({
  name: z.string().min(2).max(100),
  designation: z.string().max(100).nullable().optional(),
  avatarUrl: z.string().url().or(z.literal("")).nullable().optional(),
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

export const personalChecklistItemSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  completed: z.boolean(),
});

export const personalTaskCreateSchema = z.object({
  title: z.string().min(1, "Task title is required").max(200),
  notes: z.string().max(5000).nullable().optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"]).default("TODO"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  category: z.string().min(1).max(40).default("General"),
  dueDate: z
    .string()
    .nullable()
    .optional()
    .refine(isNotPastDate, {
      message: "Due date cannot be in the past",
    }),
  isPinned: z.boolean().default(false),
  checklist: z.array(personalChecklistItemSchema).default([]),
});

export const personalTaskUpdateSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200).optional(),
  notes: z.string().max(5000).nullable().optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  category: z.string().min(1).max(40).optional(),
  dueDate: z.string().nullable().optional(),
  isPinned: z.boolean().optional(),
  checklist: z.array(personalChecklistItemSchema).optional(),
});

