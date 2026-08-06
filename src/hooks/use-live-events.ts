// Client-side access to the live (ingested) event feed.
// Keeps a module-level snapshot so pages that only need event lookups
// (tracker, scorecard, signal detail) can read it without their own query.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listLiveEvents } from "@/lib/live-events.functions";
import { registerEventMeta } from "@/lib/ripple-regions";
import type { RippleEvent } from "@/lib/ripple-data";

let snapshot: RippleEvent[] = [];

/** Last loaded feed. Empty until the query resolves on the current page. */
export function loadedEvents(): RippleEvent[] {
  return snapshot;
}

export interface IngestRun {
  started_at: string;
  finished_at: string | null;
  ok: boolean;
  error: string | null;
  events_created: number;
  headlines_seen: number;
}

export function useLiveEvents() {
  const fetcher = useServerFn(listLiveEvents);
  const query = useQuery({
    queryKey: ["live-events"],
    queryFn: () => fetcher(),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: true,
  });

  // Register synchronously so the same render can resolve regions/top picks.
  if (query.data) {
    registerEventMeta(query.data.meta ?? {});
    snapshot = query.data.events as RippleEvent[];
  }

  return {
    events: (query.data?.events ?? []) as RippleEvent[],
    lastIngest: (query.data?.lastIngest ?? null) as IngestRun | null,
    isLoading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
  };
}
