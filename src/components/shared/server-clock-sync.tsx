"use client";

import { useEffect } from "react";
import { setServerClockOffset } from "@/lib/utils/server-clock";

export function ServerClockSync({ serverNowMs }: { serverNowMs: number }) {
  // Synchronously prime offset on initial render before child components compute today
  if (typeof window !== "undefined") {
    setServerClockOffset(serverNowMs);
  }

  useEffect(() => {
    let active = true;

    const syncFromServer = async () => {
      try {
        const t0 = Date.now();
        const res = await fetch("/api/time", { cache: "no-store" });
        if (!res.ok || !active) return;
        const json = await res.json();
        const t1 = Date.now();
        if (typeof json?.now === "number") {
          // Adjust for half round-trip latency
          const estimatedServerNow = json.now + Math.round((t1 - t0) / 2);
          setServerClockOffset(estimatedServerNow);
        }
      } catch {
        // Keep existing SSR offset if offline
      }
    };

    syncFromServer();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        syncFromServer();
      }
    };
    window.addEventListener("focus", syncFromServer);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      active = false;
      window.removeEventListener("focus", syncFromServer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return null;
}
