"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RefreshCw, WifiOff } from "lucide-react";
import { toast } from "sonner";

export function OfflineMonitor() {
  const [isOffline, setIsOffline] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOffline = () => {
      setIsOffline(true);
    };

    const handleOnline = () => {
      setIsOffline((wasOffline) => {
        if (wasOffline) {
          toast.success("Back online — connection restored");
        }
        return false;
      });
    };

    if (!navigator.onLine) {
      setIsOffline(true);
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  const handleRetry = useCallback(async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/time", {
        cache: "no-store",
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        setIsOffline(false);
        toast.success("Back online — connection restored");
        return;
      }
      toast.error("Still unable to reach Lakshya servers");
    } catch {
      toast.error("Still offline — please check your internet connection");
    } finally {
      setChecking(false);
    }
  }, []);

  return (
    <AnimatePresence>
      {isOffline && (
        <motion.div
          key="offline-top-banner"
          initial={{ opacity: 0, y: -28 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -28 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2.5 rounded-full border border-amber-200 bg-white/95 backdrop-blur-md px-4 py-1.5 shadow-lg"
        >
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
          </span>
          <WifiOff className="h-3.5 w-3.5 text-amber-600 shrink-0" />
          <span className="text-xs font-medium text-[#20232B] whitespace-nowrap">
            No internet connection — changes won&apos;t sync until back online
          </span>
          <button
            type="button"
            onClick={handleRetry}
            disabled={checking}
            className="inline-flex items-center gap-1 rounded-full bg-[#F0EFFF] px-2.5 py-0.5 text-[11px] font-semibold text-[#5148C9] hover:bg-[#E8E6FF] transition-colors disabled:opacity-60 shrink-0"
          >
            <RefreshCw
              className={`h-3 w-3 ${checking ? "animate-spin" : ""}`}
            />
            {checking ? "Checking..." : "Retry"}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
