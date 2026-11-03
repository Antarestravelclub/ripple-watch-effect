import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ManualPaperTradeButton } from "@/components/paper-trade-dialog";
import { timeMachine, type TimeMachineResult } from "@/lib/rebound.functions";
import { TimeMachineChart } from "@/components/time-machine-chart";

const money = (v: number | null) => (v == null ? "—" : `$${v.toFixed(2)}`);

const VERDICT_TM: Record<TimeMachineResult["verdict"], string> = {
  Favourable: "border-tailwind/40 bg-tailwind/15 text-tailwind",
  "Coin flip": "border-border bg-muted/40 text-foreground",
  Unfavourable: "border-headwind/40 bg-headwind/15 text-headwind",
  "Not enough history": "border-border bg-muted/40 text-muted-foreground",
};

export function TimeMachinePanel({
  symbol, days = 2, horizon = 10, stop, target, showBuy = false, showChart = false,
}: { symbol: string; days?: number; horizon?: number; stop?: number; target?: number; showBuy?: boolean; showChart?: boolean }) {
  const fn = useServerFn(timeMachine);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["time-machine", symbol, days, horizon, stop ?? null, target ?? null],
    queryFn: () => fn({ data: { symbol, days, horizon, stop, target } }),
    staleTime: 20 * 60_000,
  });
  if (isLoading) return <p className="text-[11px] text-muted-foreground">Time Machine: replaying 10,000 paths…</p>;
  if (isError || !data) return <p className="text-[11px] text-muted-foreground">Time Machine unavailable for {symbol}.</p>;
  const s = data.sim, h = data.history;
  const bar = (pct: number, cls: string) => <div className={cls} style={{ width: `${pct}%` }} />;
  return (
    <div className="rounded-lg border border-border/60 bg-card/60 p-3">
      {showChart && <div className="mb-3"><TimeMachineChart data={data} /></div>}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="text-xs font-medium">Time Machine · next {data.horizonDays} sessions</div>
        <div className="flex items-center gap-2">
          <span className={"rounded border px-1.5 py-0.5 text-[11px] " + VERDICT_TM[data.verdict]}>{data.verdict}</span>
          {showBuy && (
            <ManualPaperTradeButton
              symbol={data.symbol}
              label={`Buy ${data.symbol}`}
              compact
              preset={{
                stop: data.stop,
                target: data.target,
                notes: `Time Machine ${data.horizonDays}d: ${data.verdict}, target first ${data.sim.targetPct.toFixed(0)}% / stop first ${data.sim.stopPct.toFixed(0)}%`,
              }}
            />
          )}
        </div>
      </div>
      <div className="text-[11px] text-muted-foreground mb-1">
        Entry {money(data.entry)} · target {money(data.target)} · stop {money(data.stop)} · reward/risk {data.rewardRisk.toFixed(1)}
        {" · "}{data.mode === "custom" ? "your levels" : data.mode === "rebound" ? "rebound rule (stop under recent low, target = 20-day avg)" : "ATR rule (stop 1.5 ATR, target 3 ATR)"}
      </div>
      <div className="flex h-2 rounded overflow-hidden bg-muted mb-1">
        {bar(s.targetPct, "bg-tailwind")}{bar(s.openPct, "bg-muted-foreground/30")}{bar(s.stopPct, "bg-headwind")}
      </div>
      <div className="flex flex-wrap gap-x-4 text-[11px]">
        <span className="text-tailwind">Target first {s.targetPct.toFixed(1)}%</span>
        <span className="text-headwind">Stop first {s.stopPct.toFixed(1)}%</span>
        <span className="text-muted-foreground">Neither {s.openPct.toFixed(1)}%</span>
        {s.medianDaysToTarget != null && <span className="text-muted-foreground">Median {s.medianDaysToTarget}d to target</span>}
      </div>
      <div className="mt-2 text-[11px]">
        {h.fired > 0 ? (
          <>{data.mode === "rebound" ? `Past selloffs like this on ${symbol}` : `Same trade entered on every past day (2 yrs)`}: <b>{h.fired}</b> — {h.target} hit target ({Math.round((h.target / h.fired) * 100)}%), {h.stop} hit stop ({Math.round((h.stop / h.fired) * 100)}%), {h.neither} neither.</>
        ) : (
          <span className="text-muted-foreground">No past selloff this stretched on {symbol} in 2 years to compare against.</span>
        )}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        {s.paths.toLocaleString()} paths resampled from {symbol}'s own last-year daily bars (seed {data.seed}). Same-day target+stop counts as a stop.
      </p>
    </div>
  );
}

