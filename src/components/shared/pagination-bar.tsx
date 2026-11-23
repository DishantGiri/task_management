"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface PaginationBarProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  itemLabel?: string;
  className?: string;
}

export function PaginationBar({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  itemLabel = "items",
  className,
}: PaginationBarProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalPages <= 1) return null;

  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const start = (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, totalItems);

  // Build compact page number sequence with ellipsis
  const pages: (number | "ellipsis")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (safePage > 3) pages.push("ellipsis");
    const lo = Math.max(2, safePage - 1);
    const hi = Math.min(totalPages - 1, safePage + 1);
    for (let i = lo; i <= hi; i++) pages.push(i);
    if (safePage < totalPages - 2) pages.push("ellipsis");
    pages.push(totalPages);
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#EAECF0] bg-white px-4 py-2.5 text-xs text-[#737987]",
        className
      )}
    >
      <span>
        Showing <strong className="text-[#20232B]">{start}–{end}</strong> of{" "}
        <strong className="text-[#20232B]">{totalItems}</strong> {itemLabel}
      </span>

      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Prev
        </Button>

        {pages.map((p, idx) =>
          p === "ellipsis" ? (
            <span
              key={`el-${idx}`}
              className="px-1.5 text-xs text-[#9CA3AF] select-none"
            >
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={cn(
                "inline-flex h-7 min-w-[28px] items-center justify-center rounded-md px-2 text-xs font-medium transition-colors",
                p === safePage
                  ? "bg-[#635BDB] text-white shadow-subtle"
                  : "text-[#525866] hover:bg-[#F3F4F6] hover:text-[#20232B]"
              )}
            >
              {p}
            </button>
          )
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
          aria-label="Next page"
        >
          Next
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
