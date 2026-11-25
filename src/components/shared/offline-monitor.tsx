"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RefreshCw, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function OfflineMonitor() {
  const [isOffline, setIsOffline] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOffline = () => {
      setIsOffline(true);
      setMinimized(false);
    };

    const handleOnline = () => {
      setIsOffline((wasOffline) => {
        if (wasOffline) {
          toast.success("Back online — connection restored");
        }
        return false;
      });
      setMinimized(false);
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
        setMinimized(false);
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
      {isOffline && !minimized && (
        <motion.div
          key="offline-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#F7F8FA]/95 backdrop-blur-md px-6 text-center"
        >
          {/* Ambient radial glow */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden"
          >
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[420px] w-[420px] rounded-full bg-[#635BDB]/10 blur-3xl" />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-md rounded-2xl border border-[#EAECF0] bg-white p-8 shadow-xl"
          >
            {/* Brand Logo */}
            <div className="flex justify-center mb-6">
              <img
                src="/logo.png"
                alt="Lakshya"
                className="h-9 w-auto object-contain dark:hidden"
              />
              <img
                src="/logo-dark.png"
                alt="Lakshya"
                className="hidden h-9 w-auto object-contain dark:block"
              />
            </div>

            {/* Animated Offline Radar Emblem */}
            <div className="relative mx-auto mb-6 flex h-24 w-24 items-center justify-center">
              <motion.span
                aria-hidden="true"
                className="absolute inset-0 rounded-full border border-[#635BDB]/25"
                animate={{ scale: [1, 1.35, 1], opacity: [0.5, 0, 0.5] }}
                transition={{
                  duration: 2.6,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
              <motion.span
                aria-hidden="true"
                className="absolute inset-2.5 rounded-full border border-[#635BDB]/35"
                animate={{ scale: [1, 1.2, 1], opacity: [0.7, 0.15, 0.7] }}
                transition={{
                  duration: 2.6,
                  delay: 0.35,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
              <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-[#DFDCFF] bg-[#F0EFFF] text-[#635BDB] shadow-subtle">
                <WifiOff className="h-6 w-6" />
              </div>
            </div>

            <h2 className="text-[20px] font-semibold tracking-tight text-[#20232B]">
              No internet connection
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-[#737987]">
              It looks like you&apos;re offline. Check your Wi-Fi or network
              connection — Lakshya will reconnect automatically once you&apos;re
              back online.
            </p>

            {/* Live Status Pill */}
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11.5px] font-medium text-amber-800">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
              </span>
              Waiting for network...
            </div>

            {/* Actions */}
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2.5">
              <Button
                type="button"
                onClick={handleRetry}
                disabled={checking}
                className="w-full sm:w-auto min-w-[140px]"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${checking ? "animate-spin" : ""}`}
                />
                {checking ? "Checking..." : "Try Again"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setMinimized(true)}
                className="w-full sm:w-auto"
              >
                View Page Offline
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Minimized Floating Offline Banner */}
      {isOffline && minimized && (
        <motion.div
          key="offline-banner"
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -24 }}
          transition={{ duration: 0.2 }}
          className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 rounded-full border border-amber-200 bg-white/95 backdrop-blur px-4 py-1.5 shadow-lg"
        >
          <WifiOff className="h-3.5 w-3.5 text-amber-600 shrink-0" />
          <span className="text-xs font-medium text-[#20232B] whitespace-nowrap">
            You&apos;re offline — changes won&apos;t sync yet
          </span>
          <button
            type="button"
            onClick={handleRetry}
            disabled={checking}
            className="inline-flex items-center gap-1 rounded-full bg-[#F0EFFF] px-2.5 py-0.5 text-[11px] font-semibold text-[#5148C9] hover:bg-[#E8E6FF] transition-colors disabled:opacity-60"
          >
            <Wifi className="h-3 w-3" />
            {checking ? "Checking..." : "Retry"}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
