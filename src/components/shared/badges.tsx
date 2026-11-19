import {
  AlertCircle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  Circle,
  Clock,
  Eye,
} from "lucide-react";
import {
  cn,
  PRIORITY_CONFIG,
  PROJECT_STATUS_CONFIG,
  ROLE_CONFIG,
  STATUS_CONFIG,
} from "@/lib/utils";
import type { Priority, ProjectStatus, Role, TaskStatus } from "@prisma/client";

export function TaskStatusBadge({
  status,
  compact = false,
}: {
  status: TaskStatus;
  compact?: boolean;
}) {
  const cfg = STATUS_CONFIG[status];
  const Icon =
    status === "DONE"
      ? CheckCircle2
      : status === "IN_REVIEW"
      ? Eye
      : status === "IN_PROGRESS"
      ? Clock
      : Circle;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[5px] border font-medium whitespace-nowrap",
        compact ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-0.5 text-[11px]",
        cfg.bg
      )}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {cfg.label}
    </span>
  );
}

export function PriorityBadge({
  priority,
  showLabel = true,
}: {
  priority: Priority;
  showLabel?: boolean;
}) {
  const cfg = PRIORITY_CONFIG[priority];
  const Icon =
    priority === "URGENT"
      ? AlertCircle
      : priority === "HIGH"
      ? ArrowUp
      : priority === "MEDIUM"
      ? ArrowRight
      : ArrowDown;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[5px] border px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap",
        cfg.bg
      )}
      title={`Priority: ${cfg.label}`}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {showLabel ? cfg.label : null}
    </span>
  );
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const cfg = PROJECT_STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[5px] border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        cfg.bg
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
      {cfg.label}
    </span>
  );
}

export function RoleBadge({ role }: { role: Role }) {
  const cfg = ROLE_CONFIG[role];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[5px] border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        cfg.bg
      )}
    >
      {cfg.label}
    </span>
  );
}
