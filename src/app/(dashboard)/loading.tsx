import { LumaSpin } from "@/components/ui/luma-spin";

export default function DashboardLoading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
      <LumaSpin />
      <p className="text-xs font-medium text-[#737987]">Loading workspace...</p>
    </div>
  );
}
