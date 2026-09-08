import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { SiteShell } from "@/components/site-shell";
import { listSignals, evaluateSignals, lastEvaluationRun } from "@/lib/signals.functions";
import { computeMetrics, fmtPct, pctTone } from "@/lib/signal-metrics";
import { useLiveEvents } from "@/hooks/use-live-events";
import { STANCE_LABEL, STANCE_CLASS, type Stance } from "@/lib/ticker-rollup";

export const Route = createFileRoute("/scorecard")({
  head: () => ({
    meta: [
      { title: "Scorecard — The Ripple Effect" },
      {
        name: "description",
        content:
          "Historical hit rate and average move of tracked ripple signals, broken down by event category. Educational only.",
      },
      { property: "og:title", content: "Scorecard — The Ripple Effect" },
      {
        property: "og:description",
        content: "How ripple signals have behaved historically. Not advice.",
      },
    ],
  }),
  component: Scorecard,
});

function daysToResolution(signalTs: string, closedAt: string | null): number | null {
  if (!closedAt) return null;
  const d = (new Date(closedAt).getTime() - new Date(signalTs).getTime()) / 86_400_000;
  return Math.max(0, Math.round(d));
}

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function agoLabel(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

/** "Last checked" readout: proves the automatic 15-minute check is running. */
function LastCheckedLine() {
  const fetchRun = useServerFn(lastEvaluationRun);
  const { data } = useQuery({
    queryKey: ["signals", "last-evaluation"],
    queryFn: () => fetchRun(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const run = data?.run ?? null;
  if (!run) return null;

  if (!run.ok) {
    return (
      <p className="text-[11px] text-amber-400 mt-1">
        Last automatic check {agoLabel(run.finished_at)} did not finish
        {run.error ? ` — ${run.error}` : ""}.
      </p>
    );
  }

  const parts = [
    run.target_hits > 0 ? `${run.target_hits} reached target` : null,
    run.invalidated > 0 ? `${run.invalidated} stopped out` : null,
    run.expired > 0 ? `${run.expired} expired` : null,
  ].filter(Boolean) as string[];

  return (
    <p className="text-[11px] text-muted-foreground mt-1">
      <span className="text-foreground/80">Last checked {agoLabel(run.finished_at)}</span>
      {" — "}
      {parts.length > 0
        ? parts.join(", ")
        : `${run.evaluated} open signal${run.evaluated === 1 ? "" : "s"} reviewed, no changes`}
      . Checks run automatically every 15 minutes on weekdays.
    </p>
  );
}


function Scorecard() {
  const list = useServerFn(listSignals);
  const evaluate = useServerFn(evaluateSignals);

  // Evaluate open signals on page load (at most once every 10 minutes).
  const evalQuery = useQuery({
    queryKey: ["signals", "evaluate"],
    queryFn: () => evaluate(),
    staleTime: 600_000,
    refetchOnWindowFocus: false,
  });

  const { data } = useSuspenseQuery({
    queryKey: ["signals", "all", evalQuery.dataUpdatedAt],
    queryFn: () => list(),
    staleTime: 30_000,
  });

  const { events: liveEvents } = useLiveEvents();
  const eventById = useMemo(
    () => new Map(liveEvents.map((e) => [e.id, e])),
    [liveEvents],
  );

  const enriched = useMemo(
    () =>
      data.signals.map((s) => {
        const snap = data.latest[s.id];
        const virtualSnapshots = snap
          ? [{ price: snap.price, captured_at: snap.captured_at }]
          : [];
        const m = computeMetrics(s, virtualSnapshots);
        return { signal: s, event: eventById.get(s.event_id), metrics: m };
      }),
    [data, eventById],
  );

  const totalTracked = enriched.length;
  const targetHits = enriched.filter((r) => r.signal.close_reason === "target").length;
  const invalidated = enriched.filter((r) =>
    ["invalidation", "stop", "close_beyond", "event_reversed"].includes(
      r.signal.close_reason ?? "",
    ),
  ).length;
  const expired = enriched.filter((r) =>
    ["expired", "max_days_open"].includes(r.signal.close_reason ?? ""),
  ).length;
  const resolved = targetHits + invalidated + expired;
  const hitRate = resolved > 0 ? (targetHits / resolved) * 100 : null;


  const withMove = enriched.filter((r) => r.metrics.currentPct != null);
  const avgMove =
    withMove.length > 0
      ? withMove.reduce((a, b) => a + (b.metrics.currentPct ?? 0), 0) / withMove.length
      : null;

  const allDays = enriched
    .map((r) => daysToResolution(r.signal.signal_timestamp, r.signal.closed_at))
    .filter((d): d is number => d != null);
  const medianDays = median(allDays);

  // Attribute each ticker's realized price move ONCE, to its net stance, so a
  // single move is never counted twice in opposite directions from two events.
  const perTicker = useMemo(() => {
    const map = new Map<
      string,
      {
        ticker: string;
        longs: number;
        shorts: number;
        rawPct: number | null;
        earliest: number;
        headline: string;
      }
    >();
    for (const r of enriched) {
      const rec =
        map.get(r.signal.ticker) ??
        {
          ticker: r.signal.ticker,
          longs: 0,
          shorts: 0,
          rawPct: null as number | null,
          earliest: Infinity,
          headline: "",
        };
      if (r.signal.direction === "long") rec.longs++;
      else rec.shorts++;
      const ts = new Date(r.signal.signal_timestamp).getTime();
      const pct = r.metrics.currentPct;
      if (pct != null && ts < rec.earliest) {
        rec.earliest = ts;
        // Undo the per-signal direction sign to get the raw price move.
        rec.rawPct = r.signal.direction === "long" ? pct : -pct;
        rec.headline = r.event?.headline ?? "";
      }
      map.set(r.signal.ticker, rec);
    }
    return [...map.values()].map((rec) => {
      const stance: Stance =
        rec.longs > 0 && rec.shorts > 0
          ? "conflicted"
          : rec.shorts > 0
            ? "short"
            : "long";
      const attributed =
        rec.rawPct == null || stance === "conflicted"
          ? null
          : stance === "short"
            ? -rec.rawPct
            : rec.rawPct;
      return { ...rec, stance, attributed };
    });
  }, [enriched]);

  const attributable = perTicker
    .filter((t) => t.attributed != null)
    .sort((a, b) => (b.attributed ?? 0) - (a.attributed ?? 0));
  const conflictedCount = perTicker.filter((t) => t.stance === "conflicted").length;
  const best = attributable.slice(0, 5);
  const worst = attributable.slice(-5).reverse();

  // By category
  const catMap = new Map<
    string,
    {
      total: number;
      targets: number;
      invalidated: number;
      expired: number;
      moves: number[];
      days: number[];
    }
  >();
  for (const r of enriched) {
    const cat = r.event?.category ?? "Unknown";
    const rec =
      catMap.get(cat) ??
      { total: 0, targets: 0, invalidated: 0, expired: 0, moves: [], days: [] };
    rec.total++;
    const reason = r.signal.close_reason ?? "";
    if (reason === "target") rec.targets++;
    if (["invalidation", "stop", "close_beyond", "event_reversed"].includes(reason))
      rec.invalidated++;
    if (["expired", "max_days_open"].includes(reason)) rec.expired++;

    if (r.metrics.currentPct != null) rec.moves.push(r.metrics.currentPct);
    const d = daysToResolution(r.signal.signal_timestamp, r.signal.closed_at);
    if (d != null) rec.days.push(d);
    catMap.set(cat, rec);
  }

  return (
    <SiteShell>
      <div className="mb-4">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Scorecard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Observed historical behaviour of ripple signals. Educational research
          only — past behaviour does not predict future prices.
        </p>
        <p className="text-[11px] text-muted-foreground mt-1">
          {evalQuery.isFetching
            ? "Evaluating open signals against target and invalidation levels…"
            : "Signals resolve on target, invalidation, or after 10 trading days (expired). Delayed prices."}
        </p>
        <LastCheckedLine />
      </div>

      <BenchmarkSection
        signals={enriched.map((r) => ({
          signal: r.signal,
          category: r.event?.category ?? "Unknown",
        }))}
      />




      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Kpi
          label="Signals tracked"
          value={String(totalTracked)}
          sub={`${enriched.length - resolved} still open`}
        />
        <Kpi
          label="Target-hit rate"
          value={hitRate == null ? "—" : hitRate.toFixed(0) + "%"}
          sub={`${targetHits} target / ${invalidated} invalidated / ${expired} expired`}
        />
        <Kpi
          label="Avg move (in favour)"
          value={avgMove == null ? "—" : fmtPct(avgMove)}
          tone={pctTone(avgMove)}
        />
        <Kpi
          label="Median days to resolution"
          value={medianDays == null ? "—" : String(medianDays)}
          sub={`${resolved} resolved`}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <PerfList
          title="Best performers"
          rows={best}
          tone="tailwind"
          conflictedCount={conflictedCount}
        />
        <PerfList
          title="Worst performers"
          rows={worst}
          tone="headwind"
          conflictedCount={conflictedCount}
        />
      </div>

      <div className="rounded-xl border border-border/70 bg-card/40 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-muted-foreground uppercase tracking-wider text-[10px]">
            <tr className="border-b border-border/60">
              <th className="text-left p-2">Category</th>
              <th className="text-right p-2">Signals</th>
              <th className="text-right p-2">Target hits</th>
              <th className="text-right p-2">Invalidated</th>
              <th className="text-right p-2">Expired</th>
              <th className="text-right p-2">Hit rate</th>
              <th className="text-right p-2">Median days</th>
              <th className="text-right p-2">Avg move</th>
            </tr>
          </thead>
          <tbody>
            {Array.from(catMap.entries()).map(([cat, rec]) => {
              const closedN = rec.targets + rec.invalidated + rec.expired;
              const hr = closedN > 0 ? (rec.targets / closedN) * 100 : null;
              const avg =
                rec.moves.length > 0
                  ? rec.moves.reduce((a, b) => a + b, 0) / rec.moves.length
                  : null;
              const md = median(rec.days);
              return (
                <tr key={cat} className="border-b border-border/40 last:border-b-0">
                  <td className="p-2">{cat}</td>
                  <td className="p-2 text-right tabular-nums">{rec.total}</td>
                  <td className="p-2 text-right tabular-nums text-tailwind">{rec.targets}</td>
                  <td className="p-2 text-right tabular-nums text-headwind">{rec.invalidated}</td>
                  <td className="p-2 text-right tabular-nums text-muted-foreground">
                    {rec.expired}
                  </td>
                  <td className="p-2 text-right tabular-nums">
                    <div>{hr == null ? "—" : hr.toFixed(0) + "%"}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {rec.targets}/{closedN} resolved
                    </div>
                  </td>
                  <td className="p-2 text-right tabular-nums">{md == null ? "—" : md}</td>
                  <td className={"p-2 text-right tabular-nums " + pctTone(avg)}>
                    {fmtPct(avg)}
                  </td>
                </tr>
              );
            })}
            {catMap.size === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-muted-foreground">
                  No signals tracked yet. Visit the{" "}
                  <Link to="/tracker" className="text-primary hover:underline">
                    Tracker
                  </Link>{" "}
                  to generate them.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </SiteShell>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={"mt-1 text-xl font-mono tabular-nums " + (tone ?? "text-foreground")}>
        {value}
      </div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function PerfList({
  title,
  rows,
  tone,
  conflictedCount,
}: {
  title: string;
  rows: {
    ticker: string;
    headline: string;
    stance: Stance;
    attributed: number | null;
  }[];
  tone: "tailwind" | "headwind";
  conflictedCount: number;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-card/40 p-4">
      <h3 className={"text-xs font-semibold uppercase tracking-wider mb-2 text-" + tone}>
        {title}
      </h3>
      <p className="text-[10px] text-muted-foreground mb-2">
        One row per ticker — the move is attributed once, to its net stance.
        {conflictedCount > 0 &&
          ` ${conflictedCount} conflicted ticker(s) excluded.`}
      </p>
      <div className="space-y-1.5">
        {rows.length === 0 && <div className="text-xs text-muted-foreground">—</div>}
        {rows.map((r) => (
          <Link
            key={r.ticker}
            to="/tickers/$symbol"
            params={{ symbol: r.ticker }}
            className="flex items-center gap-2 text-xs hover:bg-background/40 rounded px-1.5 py-1"
          >
            <span className="font-mono font-semibold">{r.ticker}</span>
            <span
              className={
                "rounded border px-1 text-[9px] font-mono " + STANCE_CLASS[r.stance]
              }
            >
              {STANCE_LABEL[r.stance]}
            </span>
            <span className="flex-1 truncate text-muted-foreground">{r.headline}</span>
            <span className={"font-mono tabular-nums " + pctTone(r.attributed)}>
              {fmtPct(r.attributed)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
