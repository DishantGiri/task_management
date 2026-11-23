"use client";

import * as React from "react";
import { format, startOfDay } from "date-fns";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

function parseDateString(val: string | null | undefined): Date | undefined {
  if (!val) return undefined;
  const iso = val.slice(0, 10);
  const parts = iso.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return undefined;
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export interface DatePickerProps {
  id?: string;
  value?: string | null;
  onChange: (value: string) => void;
  minDate?: string;
  placeholder?: string;
  disabled?: boolean;
  clearable?: boolean;
  className?: string;
  align?: "start" | "center" | "end";
}

export function DatePicker({
  id,
  value,
  onChange,
  minDate,
  placeholder = "Pick a date",
  disabled = false,
  clearable = true,
  className,
  align = "start",
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  const selectedDate = React.useMemo(() => parseDateString(value), [value]);
  const parsedMinDate = React.useMemo(
    () => (minDate ? parseDateString(minDate) : undefined),
    [minDate]
  );

  const today = startOfDay(new Date());
  const canPickToday = !parsedMinDate || today >= startOfDay(parsedMinDate);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          className={cn(
            "inline-flex h-10 w-full items-center justify-between gap-2 rounded-md border border-[#E2E6EE] bg-white px-3 text-left text-xs font-normal transition-colors hover:border-[#C7CDD8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#635BDB]/30 focus-visible:border-[#635BDB] disabled:cursor-not-allowed disabled:bg-[#F7F8FA] disabled:opacity-60",
            selectedDate ? "text-[#20232B]" : "text-[#9CA3AF]",
            className
          )}
        >
          <span className="inline-flex items-center gap-1.5 truncate">
            <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-[#737987]" />
            <span className="truncate">
              {selectedDate ? format(selectedDate, "MMM d, yyyy") : placeholder}
            </span>
          </span>
          {clearable && selectedDate && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Clear date"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              className="rounded p-0.5 text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#20232B]"
            >
              <X className="h-3 w-3" />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        className="z-[100] w-auto p-0 rounded-lg border border-[#EAECF0] bg-white shadow-lg"
      >
        <Calendar
          mode="single"
          selected={selectedDate}
          defaultMonth={selectedDate ?? parsedMinDate ?? today}
          disabled={parsedMinDate ? { before: parsedMinDate } : undefined}
          onSelect={(date) => {
            if (!date) {
              onChange("");
              setOpen(false);
              return;
            }
            onChange(toDateString(date));
            setOpen(false);
          }}
          captionLayout="dropdown"
        />
        <div className="flex items-center justify-between border-t border-[#F1F3F7] px-3 py-2 text-xs">
          {clearable && selectedDate ? (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="font-medium text-[#737987] hover:text-[#20232B]"
            >
              Clear
            </button>
          ) : (
            <span />
          )}
          {canPickToday && (
            <button
              type="button"
              onClick={() => {
                onChange(toDateString(today));
                setOpen(false);
              }}
              className="font-medium text-[#635BDB] hover:text-[#5148C9]"
            >
              Today
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
