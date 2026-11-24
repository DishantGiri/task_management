"use client";

import { useMemo, useState } from "react";
import { Activity, Search, X } from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserAvatar } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PaginationBar } from "@/components/shared/pagination-bar";

export interface ActivityFeedItem {
  id: string;
  action?: string;
  description: string;
  createdAt: string;
  actor: { id: string; name: string; avatarUrl: string | null };
  project?: { id: string; name: string; color: string } | null;
}

type ActivityCategory = "ALL" | "STATUS" | "TASKS" | "UPDATES" | "PROJECTS";

const CATEGORY_TABS: { key: ActivityCategory; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "STATUS", label: "Status" },
  { key: "TASKS", label: "Tasks & Subtasks" },
  { key: "UPDATES", label: "Comments & Files" },
  { key: "PROJECTS", label: "Projects" },
];

function matchesCategory(item: ActivityFeedItem, cat: ActivityCategory): boolean {
  if (cat === "ALL") return true;
  const action = (item.action || "").toUpperCase();
  const desc = item.description.toLowerCase();

  if (cat === "STATUS") {
    return (
      action === "STATUS_CHANGED" ||
      desc.includes("moved") ||
      desc.includes("status")
    );
  }
  if (cat === "TASKS") {
    return (
      action === "TASK_CREATED" ||
      action === "SUBTASK_ADDED" ||
      action === "ASSIGNEE_CHANGED" ||
      action === "TASK_DELETED" ||
      desc.includes("task") ||
      desc.includes("subtask") ||
      desc.includes("reassigned")
    );
  }
  if (cat === "UPDATES") {
    return (
      action === "COMMENT_ADDED" ||
      action === "ATTACHMENT_UPLOADED" ||
      action === "ATTACHMENT_DELETED" ||
      desc.includes("comment") ||
      desc.includes("attached") ||
      desc.includes("attachment")
    );
  }
  return (
    action.startsWith("PROJECT_") ||
    action.startsWith("MILESTONE_") ||
    action.startsWith("MEMBER_") ||
    desc.includes("project") ||
    desc.includes("milestone")
  );
}

export function RecentActivityCard({
  activities,
  title = "Recent Activity",
  subtitle = "Latest updates across projects and tasks",
  showProjectFilter = true,
  pageSize = 8,
  className,
}: {
  activities: ActivityFeedItem[];
  title?: string;
  subtitle?: string;
  showProjectFilter?: boolean;
  pageSize?: number;
  className?: string;
}) {
  const [category, setCategory] = useState<ActivityCategory>("ALL");
  const [actorFilter, setActorFilter] = useState("ALL");
  const [projectFilter, setProjectFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const actors = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of activities) {
      map.set(a.actor.id, a.actor.name);
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [activities]);

  const projects = useMemo(() => {
    const map = new Map<string, { id: string; name: string; color: string }>();
    for (const a of activities) {
      if (a.project) {
        map.set(a.project.id, a.project);
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [activities]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activities.filter((item) => {
      if (!matchesCategory(item, category)) return false;
      if (actorFilter !== "ALL" && item.actor.id !== actorFilter) return false;
      if (
        showProjectFilter &&
        projectFilter !== "ALL" &&
        item.project?.id !== projectFilter
      ) {
        return false;
      }
      if (q) {
        const hay = `${item.actor.name} ${item.description} ${
          item.project?.name || ""
        }`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    activities,
    category,
    actorFilter,
    projectFilter,
    showProjectFilter,
    search,
  ]);

  const hasActiveFilters =
    category !== "ALL" ||
    actorFilter !== "ALL" ||
    projectFilter !== "ALL" ||
    search.trim().length > 0;

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  const resetFilters = () => {
    setCategory("ALL");
    setActorFilter("ALL");
    setProjectFilter("ALL");
    setSearch("");
    setPage(1);
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle>{title}</CardTitle>
            <p className="text-xs text-[#737987] mt-0.5">{subtitle}</p>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-[#635BDB] hover:bg-[#F0EFFF] transition-colors shrink-0"
            >
              <X className="h-3 w-3" />
              Clear
            </button>
          )}
        </div>

        {/* Filter Controls */}
        <div className="space-y-2">
          {/* Category Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {CATEGORY_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setCategory(tab.key);
                  setPage(1);
                }}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                  category === tab.key
                    ? "border-[#635BDB] bg-[#F0EFFF] text-[#5148C9]"
                    : "border-[#EAECF0] bg-[#F7F8FA] text-[#525866] hover:bg-white"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search + Member + Project Dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[150px]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#9CA3AF]" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search activity..."
                className="h-7 w-full rounded-md border border-[#E2E6EE] bg-white pl-7 pr-2.5 text-xs text-[#20232B] placeholder:text-[#9CA3AF] focus:border-[#635BDB] focus:outline-none"
              />
            </div>

            {actors.length > 1 && (
              <Select
                value={actorFilter}
                onValueChange={(v) => {
                  setActorFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-7 w-[135px] text-xs">
                  <SelectValue placeholder="All members" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All members</SelectItem>
                  {actors.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {showProjectFilter && projects.length > 1 && (
              <Select
                value={projectFilter}
                onValueChange={(v) => {
                  setProjectFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-7 w-[135px] text-xs">
                  <SelectValue placeholder="All projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All projects</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {paginated.length === 0 ? (
          <div className="border-t border-[#EAECF0] px-5 py-10 text-center">
            <Activity className="mx-auto h-6 w-6 text-[#CBD5E1] mb-1.5" />
            <p className="text-xs font-medium text-[#20232B]">
              {activities.length === 0
                ? "No activity recorded yet."
                : "No activity matches your filters."}
            </p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-[#EAECF0] border-t border-[#EAECF0]">
              {paginated.map((act) => (
                <div
                  key={act.id}
                  className="flex items-start gap-3 px-5 py-3 hover:bg-[#F7F8FA]/60 transition-colors"
                >
                  <UserAvatar
                    name={act.actor.name}
                    avatarUrl={act.actor.avatarUrl}
                    size="sm"
                    className="mt-0.5 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] text-[#20232B] leading-snug break-words [overflow-wrap:anywhere]">
                      <span className="font-medium">{act.actor.name}</span>{" "}
                      <span className="text-[#525866]">{act.description}</span>
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-[#9CA3AF]">
                      <span>{formatRelativeTime(act.createdAt)}</span>
                      {act.project && (
                        <>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1 text-[#737987]">
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: act.project.color }}
                            />
                            {act.project.name}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <PaginationBar
              currentPage={safePage}
              totalItems={filtered.length}
              pageSize={pageSize}
              onPageChange={setPage}
              itemLabel="activities"
              className="rounded-none border-0 border-t border-[#EAECF0]"
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
