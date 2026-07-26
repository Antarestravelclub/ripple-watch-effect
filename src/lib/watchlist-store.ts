import { useSyncExternalStore } from "react";

const KEY = "ripple.watchlist";
let subs = new Set<() => void>();

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

let cache: string[] = [];
let hydrated = false;

function ensure() {
  if (!hydrated && typeof window !== "undefined") {
    cache = read();
    hydrated = true;
  }
}

function emit() {
  subs.forEach((s) => s());
}

export function getWatchlist(): string[] {
  ensure();
  return cache;
}

export function addTicker(t: string) {
  ensure();
  const clean = t.trim().toUpperCase();
  if (!clean) return;
  if (cache.includes(clean)) return;
  cache = [...cache, clean];
  window.localStorage.setItem(KEY, JSON.stringify(cache));
  emit();
}

export function removeTicker(t: string) {
  ensure();
  cache = cache.filter((x) => x !== t.toUpperCase());
  window.localStorage.setItem(KEY, JSON.stringify(cache));
  emit();
}

export function useWatchlist(): string[] {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => {
      ensure();
      return cache;
    },
    () => [],
  );
}
