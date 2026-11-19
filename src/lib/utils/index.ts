import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow, isPast, isToday, isTomorrow, startOfDay } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function formatShortDate(date: Date | string | null | undefined): string {
  if (!date) return "No date";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "Invalid date";
  return format(d, "MMM d, yyyy");
}

export function formatCompactDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  return format(d, "MMM d");
}

export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  return formatDistanceToNow(d, { addSuffix: true });
}

export function isTaskOverdue(
  dueDate: Date | string | null | undefined,
  status: string
): boolean {
  if (!dueDate || status === "DONE") return false;
  const d = typeof dueDate === "string" ? new Date(dueDate) : dueDate;
  return isPast(d) && startOfDay(d) < startOfDay(new Date());
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export const STATUS_CONFIG = {
  TODO: {
    label: "To Do",
    color: "#64748B",
    bg: "bg-slate-100 text-slate-700 border-slate-200/80",
    dot: "bg-slate-400",
  },
  IN_PROGRESS: {
    label: "In Progress",
    color: "#3B82F6",
    bg: "bg-blue-50 text-blue-700 border-blue-200/80",
    dot: "bg-blue-500",
  },
  IN_REVIEW: {
    label: "In Review",
    color: "#F59E0B",
    bg: "bg-amber-50 text-amber-700 border-amber-200/80",
    dot: "bg-amber-500",
  },
  DONE: {
    label: "Done",
    color: "#16A34A",
    bg: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
    dot: "bg-emerald-500",
  },
} as const;

export const PRIORITY_CONFIG = {
  LOW: {
    label: "Low",
    color: "#64748B",
    bg: "bg-slate-50 text-slate-600 border-slate-200",
  },
  MEDIUM: {
    label: "Medium",
    color: "#3B82F6",
    bg: "bg-blue-50 text-blue-700 border-blue-200",
  },
  HIGH: {
    label: "High",
    color: "#F59E0B",
    bg: "bg-amber-50 text-amber-700 border-amber-200",
  },
  URGENT: {
    label: "Urgent",
    color: "#EF4444",
    bg: "bg-red-50 text-red-700 border-red-200",
  },
} as const;

export const PROJECT_STATUS_CONFIG = {
  PLANNING: {
    label: "Planning",
    bg: "bg-slate-100 text-slate-700 border-slate-200",
    dot: "bg-slate-400",
  },
  ACTIVE: {
    label: "Active",
    bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
  },
  ON_HOLD: {
    label: "On Hold",
    bg: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
  },
  COMPLETED: {
    label: "Completed",
    bg: "bg-indigo-50 text-indigo-700 border-indigo-200",
    dot: "bg-indigo-500",
  },
  ARCHIVED: {
    label: "Archived",
    bg: "bg-zinc-100 text-zinc-600 border-zinc-200",
    dot: "bg-zinc-400",
  },
} as const;

export const ROLE_CONFIG = {
  ADMIN: {
    label: "Admin",
    bg: "bg-[#F0EFFF] text-[#5148C9] border-[#D9D6FE]",
  },
  MANAGER: {
    label: "Manager",
    bg: "bg-blue-50 text-blue-700 border-blue-200",
  },
  EMPLOYEE: {
    label: "Employee",
    bg: "bg-slate-100 text-slate-700 border-slate-200",
  },
} as const;
