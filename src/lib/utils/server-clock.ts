// Server-authoritative clock helper so changing the client OS date/time
// cannot spoof UI "Today" highlights, DatePicker min dates, or overdue badges.

const CLOCK_KEY = "__MERIDIAN_CLOCK_OFFSET_MS__";

function readGlobalOffset(): number {
  if (typeof globalThis !== "undefined") {
    const val = (globalThis as Record<string, unknown>)[CLOCK_KEY];
    if (typeof val === "number" && Number.isFinite(val)) {
      return val;
    }
  }
  return 0;
}

export function setServerClockOffset(serverNowMs: number): void {
  if (typeof window === "undefined") return;
  const offset = serverNowMs - Date.now();
  (globalThis as Record<string, unknown>)[CLOCK_KEY] = offset;
}

export function getServerNow(): Date {
  if (typeof window === "undefined") {
    return new Date();
  }
  return new Date(Date.now() + readGlobalOffset());
}

export function getServerTodayStr(): string {
  const now = getServerNow();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
