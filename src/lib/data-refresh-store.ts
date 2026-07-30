// Tiny global store recording when live market data last refreshed,
// so the header can show a single "last data refresh" timestamp.
import { useSyncExternalStore } from "react";

let lastRefresh: number | null = null;
const listeners = new Set<() => void>();

export function markDataRefresh(ts: number = Date.now()) {
  if (lastRefresh != null && ts <= lastRefresh) return;
  lastRefresh = ts;
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useLastDataRefresh(): number | null {
  return useSyncExternalStore(
    subscribe,
    () => lastRefresh,
    () => null,
  );
}
