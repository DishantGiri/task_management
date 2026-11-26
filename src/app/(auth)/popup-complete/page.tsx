"use client";

import { useEffect } from "react";
import { CheckCircle2 } from "lucide-react";

export default function PopupCompletePage() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (window.opener && !window.opener.closed) {
      try {
        window.opener.postMessage(
          { type: "lakshya-auth-complete" },
          window.location.origin
        );
      } catch {
        // ignore cross-origin issues
      }
      window.close();
    } else {
      window.location.href = "/dashboard";
    }
  }, []);

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-[#EAECF0] bg-white p-8 text-center shadow-card">
      <CheckCircle2 className="h-7 w-7 text-[#16A34A]" />
      <div>
        <p className="text-sm font-semibold text-[#20232B]">
          Signed in successfully
        </p>
        <p className="mt-1 text-xs text-[#737987]">
          Returning you to Lakshya Workspace...
        </p>
      </div>
    </div>
  );
}
