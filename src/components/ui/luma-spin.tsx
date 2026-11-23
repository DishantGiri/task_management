import { cn } from "@/lib/utils";

export function LumaSpin({ className }: { className?: string }) {
  return (
    <div
      className={cn("relative w-[65px] aspect-square", className)}
      role="status"
      aria-label="Loading"
    >
      <span className="absolute rounded-[50px] animate-luma-loader shadow-[inset_0_0_0_3px] shadow-[#635BDB]" />
      <span className="absolute rounded-[50px] animate-luma-loader luma-animation-delay shadow-[inset_0_0_0_3px] shadow-[#635BDB]/75" />
    </div>
  );
}

export const Component = LumaSpin;
