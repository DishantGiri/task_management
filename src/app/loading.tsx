import { LumaSpin } from "@/components/ui/luma-spin";

export default function RootLoading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#F7F8FA]">
      <LumaSpin />
      <p className="text-xs font-medium text-[#737987]">Loading Lakshya...</p>
    </div>
  );
}
