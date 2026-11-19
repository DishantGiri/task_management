import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-[#E2E6EE] bg-white px-3 py-2 text-[13px] text-[#20232B] shadow-subtle placeholder:text-[#9CA3AF] focus-visible:outline-none focus-visible:border-[#635BDB] focus-visible:ring-2 focus-visible:ring-[#635BDB]/15 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
