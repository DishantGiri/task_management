import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-[#E2E6EE] bg-white px-3 py-1.5 text-[13px] text-[#20232B] shadow-subtle transition-colors file:border-0 file:bg-transparent file:text-xs file:font-medium placeholder:text-[#9CA3AF] focus-visible:outline-none focus-visible:border-[#635BDB] focus-visible:ring-2 focus-visible:ring-[#635BDB]/15 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
