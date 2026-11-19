"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center rounded-lg border border-[#EAECF0] bg-white p-8 text-center shadow-subtle">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-[#EF4444] mb-3">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <h2 className="text-base font-semibold text-[#20232B]">
        Something went wrong
      </h2>
      <p className="mt-1 max-w-md text-xs text-[#737987]">
        We ran into an unexpected error loading this view. Please try again.
      </p>
      <Button size="sm" className="mt-4" onClick={reset}>
        <RefreshCw className="h-3.5 w-3.5" />
        Retry
      </Button>
    </div>
  );
}
