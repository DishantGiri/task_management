"use client";

import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { googlePopupLoginAction } from "@/actions/auth";

export default function GooglePopupPage() {
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    googlePopupLoginAction().catch(() => {
      // NextAuth signIn throws NEXT_REDIRECT which Next.js handles automatically
    });
  }, []);

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-[#EAECF0] bg-white p-8 text-center shadow-card">
      <Loader2 className="h-6 w-6 animate-spin text-[#635BDB]" />
      <div>
        <p className="text-sm font-semibold text-[#20232B]">
          Connecting to Google...
        </p>
        <p className="mt-1 text-xs text-[#737987]">
          Choose your company Google account to continue.
        </p>
      </div>
    </div>
  );
}
