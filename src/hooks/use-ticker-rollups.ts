import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { listSignals } from "@/lib/signals.functions";
import { rollupTickers, type TickerRollup } from "@/lib/ticker-rollup";

/** All ticker rollups (one per ticker with at least one active signal). */
export function useTickerRollups() {
  const list = useServerFn(listSignals);
  const query = useQuery({
    queryKey: ["signals", "all"],
    queryFn: () => list(),
    staleTime: 60_000,
  });
  const rows = useMemo<TickerRollup[]>(
    () => (query.data ? rollupTickers(query.data.signals) : []),
    [query.data],
  );
  return { rows, isLoading: query.isLoading };
}

/** Set of tickers carrying opposing active signals across events. */
export function useConflictedTickers(): Set<string> {
  const { rows } = useTickerRollups();
  return useMemo(
    () => new Set(rows.filter((r) => r.stance === "conflicted").map((r) => r.ticker)),
    [rows],
  );
}
