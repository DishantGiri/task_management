"use client";

import { useMemo, useState } from "react";
import { Check, CheckCircle2, Plus, Search, X } from "lucide-react";
import { cn, STATUS_CONFIG } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface BlockerCandidate {
  id: string;
  taskKey: string;
  title: string;
  projectId: string;
  status: string;
  isSubtask?: boolean;
}

interface BlockerPickerProps {
  projectId: string;
  excludeTaskId?: string | null;
  excludeParentId?: string | null;
  candidates: BlockerCandidate[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  disabled?: boolean;
  /** Optional metadata for already-linked dependencies (e.g. if one became DONE) */
  existingDependencies?: {
    dependsOnId: string;
    dependsOn: { id: string; taskKey: string; title: string; status: string };
  }[];
}

export function BlockerPicker({
  projectId,
  excludeTaskId,
  excludeParentId,
  candidates,
  selectedIds,
  onToggle,
  disabled = false,
  existingDependencies = [],
}: BlockerPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  // Same project only, exclude self/parent, and never offer DONE tasks/subtasks as blockers
  const openCandidates = useMemo(
    () =>
      candidates.filter(
        (c) =>
          c.projectId === projectId &&
          c.id !== excludeTaskId &&
          c.id !== excludeParentId &&
          c.status !== "DONE"
      ),
    [candidates, projectId, excludeTaskId, excludeParentId]
  );

  // Build lookup map for rendering selected chips (including any already-selected DONE deps)
  const itemLookup = useMemo(() => {
    const map = new Map<
      string,
      { id: string; taskKey: string; title: string; status: string }
    >();
    for (const c of candidates) {
      map.set(c.id, {
        id: c.id,
        taskKey: c.taskKey,
        title: c.title,
        status: c.status,
      });
    }
    for (const dep of existingDependencies) {
      if (!map.has(dep.dependsOnId)) {
        map.set(dep.dependsOnId, dep.dependsOn);
      }
    }
    return map;
  }, [candidates, existingDependencies]);

  const filteredCandidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return openCandidates;
    return openCandidates.filter(
      (c) =>
        c.taskKey.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q)
    );
  }, [openCandidates, query]);

  const selectedItems = selectedIds
    .map((id) => itemLookup.get(id))
    .filter((v): v is NonNullable<typeof v> => Boolean(v));

  return (
    <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
      {selectedItems.map((dep) => {
        const isResolved = dep.status === "DONE";
        return (
          <span
            key={dep.id}
            title={`${dep.taskKey}: ${dep.title}`}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-[5px] border px-2 py-0.5 text-[11px] font-medium max-w-[240px]",
              isResolved
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-300 bg-amber-50 text-amber-900"
            )}
          >
            {isResolved && (
              <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-600" />
            )}
            <span className="font-mono shrink-0">{dep.taskKey}</span>
            <span className="truncate font-normal opacity-90">{dep.title}</span>
            {!disabled && (
              <button
                type="button"
                onClick={() => onToggle(dep.id)}
                aria-label={`Remove blocker ${dep.taskKey}`}
                className="ml-0.5 rounded p-0.5 hover:bg-black/10 shrink-0"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            )}
          </span>
        );
      })}

      {!disabled ? (
        <Popover
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) setQuery("");
          }}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-[5px] border border-dashed border-[#D5D9E2] bg-white px-2 py-0.5 text-[11px] font-medium text-[#525866] hover:border-[#635BDB] hover:bg-[#F0EFFF]/60 hover:text-[#5148C9] transition-colors"
            >
              <Plus className="h-3 w-3" />
              Add blocker
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="z-[100] w-80 p-0 rounded-lg border border-[#EAECF0] bg-white shadow-lg"
          >
            <div className="flex items-center gap-2 border-b border-[#EAECF0] px-2.5 py-2">
              <Search className="h-3.5 w-3.5 text-[#9CA3AF] shrink-0" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search open tasks in this project..."
                className="w-full bg-transparent text-xs text-[#20232B] placeholder:text-[#9CA3AF] focus:outline-none"
                autoFocus
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="text-[#9CA3AF] hover:text-[#20232B]"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            <div className="max-h-56 overflow-y-auto p-1">
              {filteredCandidates.length === 0 ? (
                <p className="py-5 px-3 text-center text-xs text-[#737987]">
                  {openCandidates.length === 0
                    ? "No open tasks or subtasks in this project."
                    : "No matching tasks found."}
                </p>
              ) : (
                <>
                  {filteredCandidates.slice(0, 50).map((c) => {
                    const active = selectedIds.includes(c.id);
                    const statusCfg =
                      STATUS_CONFIG[c.status as keyof typeof STATUS_CONFIG];
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => onToggle(c.id)}
                        className={cn(
                          "w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                          active
                            ? "bg-[#F0EFFF] text-[#5148C9]"
                            : "text-[#20232B] hover:bg-[#F7F8FA]"
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                            active
                              ? "border-[#635BDB] bg-[#635BDB] text-white"
                              : "border-[#D5D9E2] bg-white"
                          )}
                        >
                          {active && <Check className="h-3 w-3" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[11px] font-semibold shrink-0">
                              {c.taskKey}
                            </span>
                            {c.isSubtask && (
                              <span className="rounded bg-[#F3F4F6] px-1 py-0.2 text-[9.5px] font-medium text-[#737987] shrink-0">
                                Subtask
                              </span>
                            )}
                            {statusCfg && (
                              <span
                                className={cn(
                                  "ml-auto h-1.5 w-1.5 rounded-full shrink-0",
                                  statusCfg.dot
                                )}
                                title={statusCfg.label}
                              />
                            )}
                          </div>
                          <p className="truncate text-[11.5px] text-[#525866]">
                            {c.title}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                  {filteredCandidates.length > 50 && (
                    <p className="px-2 py-1.5 text-center text-[10.5px] text-[#737987]">
                      Showing 50 of {filteredCandidates.length} — refine your
                      search
                    </p>
                  )}
                </>
              )}
            </div>
          </PopoverContent>
        </Popover>
      ) : (
        selectedItems.length === 0 && (
          <span className="text-xs text-[#9CA3AF]">None</span>
        )
      )}
    </div>
  );
}
