"use client";

import * as React from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, getDefaultClassNames } from "react-day-picker";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "dropdown",
  startMonth = new Date(new Date().getFullYear() - 2, 0),
  endMonth = new Date(new Date().getFullYear() + 10, 11),
  ...props
}: CalendarProps) {
  const defaultClassNames = getDefaultClassNames();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      captionLayout={captionLayout}
      startMonth={startMonth}
      endMonth={endMonth}
      className={cn("p-3 bg-white text-[#20232B] select-none", className)}
      classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: cn(
          "relative flex flex-col sm:flex-row gap-4",
          defaultClassNames.months
        ),
        month: cn("flex flex-col w-full gap-3", defaultClassNames.month),
        nav: cn(
          "flex items-center justify-between gap-1 w-full absolute top-0 inset-x-0 z-10 pointer-events-none",
          defaultClassNames.nav
        ),
        button_previous: cn(
          buttonVariants({ variant: "outline", size: "icon" }),
          "h-7 w-7 bg-white p-0 text-[#525866] hover:text-[#20232B] pointer-events-auto",
          defaultClassNames.button_previous
        ),
        button_next: cn(
          buttonVariants({ variant: "outline", size: "icon" }),
          "h-7 w-7 bg-white p-0 text-[#525866] hover:text-[#20232B] pointer-events-auto",
          defaultClassNames.button_next
        ),
        month_caption: cn(
          "flex items-center justify-center h-7 w-full px-8",
          defaultClassNames.month_caption
        ),
        dropdowns: cn(
          "flex items-center justify-center gap-1.5 text-xs font-medium",
          defaultClassNames.dropdowns
        ),
        dropdown_root: cn(
          "relative inline-flex items-center rounded-md border border-[#E2E6EE] bg-white px-2 py-1 text-xs font-medium text-[#20232B] hover:bg-[#F7F8FA] focus-within:ring-2 focus-within:ring-[#635BDB]/30",
          defaultClassNames.dropdown_root
        ),
        dropdown: cn(
          "absolute inset-0 opacity-0 cursor-pointer",
          defaultClassNames.dropdown
        ),
        caption_label: cn(
          "inline-flex items-center gap-1 text-xs font-semibold text-[#20232B]",
          defaultClassNames.caption_label
        ),
        month_grid: cn("w-full border-collapse", defaultClassNames.month_grid),
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn(
          "text-[#737987] rounded-md w-8 font-medium text-[11px] text-center py-1",
          defaultClassNames.weekday
        ),
        week: cn("flex w-full mt-1", defaultClassNames.week),
        day: cn(
          "relative p-0 text-center text-xs focus-within:relative focus-within:z-20 w-8 h-8 flex items-center justify-center",
          defaultClassNames.day
        ),
        day_button: cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-md text-xs font-normal text-[#20232B] transition-colors hover:bg-[#F0EFFF] hover:text-[#5148C9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#635BDB]/40 cursor-pointer",
          defaultClassNames.day_button
        ),
        selected: cn(
          "[&>button]:bg-[#635BDB] [&>button]:text-white [&>button]:font-semibold [&>button]:hover:bg-[#5148C9] [&>button]:hover:text-white",
          defaultClassNames.selected
        ),
        today: cn(
          "[&>button]:bg-[#F0EFFF] [&>button]:text-[#5148C9] [&>button]:font-semibold",
          defaultClassNames.today
        ),
        outside: cn(
          "text-[#9CA3AF] opacity-50 [&>button]:text-[#9CA3AF]",
          defaultClassNames.outside
        ),
        disabled: cn(
          "text-[#CBD5E1] opacity-45 [&>button]:cursor-not-allowed [&>button]:hover:bg-transparent [&>button]:hover:text-[#CBD5E1]",
          defaultClassNames.disabled
        ),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: chevronClassName, ...rest }) => {
          if (orientation === "left") {
            return (
              <ChevronLeft
                className={cn("h-3.5 w-3.5", chevronClassName)}
                {...rest}
              />
            );
          }
          if (orientation === "right") {
            return (
              <ChevronRight
                className={cn("h-3.5 w-3.5", chevronClassName)}
                {...rest}
              />
            );
          }
          return (
            <ChevronDown
              className={cn("h-3 w-3 text-[#737987]", chevronClassName)}
              {...rest}
            />
          );
        },
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
