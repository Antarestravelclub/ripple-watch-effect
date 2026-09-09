import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { listEtfReference } from "@/lib/etf-reference.functions";
import type { InstrumentType } from "@/lib/instrument";

/**
 * Client-side lookup for "is this ticker a fund?" — used for badges and
 * filters on surfaces that only carry a bare ticker.
 */
export function useEtfTickers() {
  const list = useServerFn(listEtfReference);
  const { data } = useQuery({
    queryKey: ["etf-reference"],
    queryFn: () => list(),
    staleTime: 3_600_000,
  });

  const set = useMemo(
    () => new Set((data?.rows ?? []).map((r) => r.ticker.toUpperCase())),
    [data],
  );

  return {
    rows: data?.rows ?? [],
    isEtf: (ticker: string) => set.has(ticker.toUpperCase()),
    instrumentOf: (ticker: string): InstrumentType =>
      set.has(ticker.toUpperCase()) ? "etf" : "stock",
  };
}
