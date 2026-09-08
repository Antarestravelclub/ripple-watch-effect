import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { listSignals } from "@/lib/signals.functions";
import { useLiveQuotes } from "@/hooks/use-live-quotes";
import { useTickerRollups } from "@/hooks/use-ticker-rollups";
import { buildSetups, dedupeByTicker, scoreTone } from "@/lib/swing-setups";
import { fmtPrice } from "@/lib/signal-metrics";
import { TickerLink } from "./ticker-link";
import type { RippleEvent } from "@/lib/ripple-data";

/** Compact strip of the highest-scoring swing setups, linking to /setups. */
export function TopSetupsStrip({ events }: { events: RippleEvent[] }) {
  const list = useServerFn(listSignals);
  const { data } = useQuery({
    queryKey: ["signals", "all"],
    queryFn: () => list(),
    staleTime: 60_000,
  });
  const { rows: rollups } = useTickerRollups();
  const eventMap = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);
  const symbols = useMemo(
    () =>
      (data?.signals ?? [])
        .filter((s) => s.status === "open")
        .map((s) => (s.quote_symbol || s.ticker).toUpperCase()),
    [data],
  );
  const { quotes } = useLiveQuotes(symbols);

  const top = useMemo(() => {
    if (!data) return [];
    const conflicted = new Set(
      rollups.filter((r) => r.stance === "conflicted").map((r) => r.ticker.toUpperCase()),
    );
    return dedupeByTicker(
      buildSetups({
        signals: data.signals,
        latest: data.latest,
        events: eventMap,
        quotes,
        conflicted,
      }).filter((s) => !s.captured && !s.conflicted && s.currentPrice != null),
    ).slice(0, 4);
  }, [data, rollups, eventMap, quotes]);

  if (top.length === 0) return null;

  return (
    <section className="mb-5 rounded-xl border border-border/70 bg-card/50 p-3">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Cleanest swing setups now
        </h2>
        <Link to="/setups" className="text-[11px] text-primary hover:underline">
          All setups →
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {top.map((s) => (
          <Link
            key={s.signal.id}
            to="/setups"
            className="rounded-lg border border-border/60 bg-background/40 px-3 py-2 hover:border-primary/50 transition-colors"
          >
            <div className="flex items-center justify-between gap-2">
              <TickerLink symbol={s.ticker} className="font-mono text-sm font-semibold">
                {s.displaySymbol}
              </TickerLink>
              <span className={"text-[10px] px-1.5 py-0.5 rounded-full border " + scoreTone(s.score)}>
                {s.score}
              </span>
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {s.direction === "long" ? "Long" : "Short"} · entry {fmtPrice(s.entryLow)}–
              {fmtPrice(s.entryHigh)}
            </div>
            <div className="text-[10px] mt-0.5">
              <span className="text-tailwind">T {fmtPrice(s.target)}</span>{" "}
              <span className="text-headwind">X {fmtPrice(s.invalidation)}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
