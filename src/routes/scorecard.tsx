import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { SiteShell } from "@/components/site-shell";
import { listSignals } from "@/lib/signals.functions";
import { computeMetrics, fmtPct, pctTone } from "@/lib/signal-metrics";
import { EVENTS } from "@/lib/ripple-data";

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

function Scorecard() {
  const list = useServerFn(listSignals);
  const { data } = useSuspenseQuery({
    queryKey: ["signals", "all"],
    queryFn: () => list(),
    staleTime: 30_000,
  });

  const eventById = useMemo(() => new Map(EVENTS.map((e) => [e.id, e])), []);

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
  const closed = enriched.filter((r) => r.signal.status === "closed");
  const targetHits = closed.filter((r) => r.signal.close_reason === "target").length;
  const invalidated = closed.filter((r) => r.signal.close_reason === "invalidation").length;
  const hitRate = closed.length > 0 ? (targetHits / closed.length) * 100 : null;
  const withMove = enriched.filter((r) => r.metrics.currentPct != null);
  const avgMove =
    withMove.length > 0
      ? withMove.reduce((a, b) => a + (b.metrics.currentPct ?? 0), 0) / withMove.length
      : null;

  const sortedByMove = [...withMove].sort(
    (a, b) => (b.metrics.currentPct ?? 0) - (a.metrics.currentPct ?? 0),
  );
  const best = sortedByMove.slice(0, 5);
  const worst = sortedByMove.slice(-5).reverse();

  // By category
  const catMap = new Map<
    string,
    { total: number; targets: number; invalidated: number; moves: number[] }
  >();
  for (const r of enriched) {
    const cat = r.event?.category ?? "Unknown";
    const rec = catMap.get(cat) ?? { total: 0, targets: 0, invalidated: 0, moves: [] };
    rec.total++;
    if (r.signal.close_reason === "target") rec.targets++;
    if (r.signal.close_reason === "invalidation") rec.invalidated++;
    if (r.metrics.currentPct != null) rec.moves.push(r.metrics.currentPct);
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
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Kpi label="Signals tracked" value={String(totalTracked)} />
        <Kpi
          label="Target-hit rate"
          value={hitRate == null ? "—" : hitRate.toFixed(0) + "%"}
          sub={`${targetHits} target / ${invalidated} invalidated`}
        />
        <Kpi
          label="Avg move (in favour)"
          value={avgMove == null ? "—" : fmtPct(avgMove)}
          tone={pctTone(avgMove)}
        />
        <Kpi
          label="Open signals"
          value={String(enriched.filter((r) => r.signal.status === "open").length)}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <PerfList title="Best performers" rows={best} tone="tailwind" />
        <PerfList title="Worst performers" rows={worst} tone="headwind" />
      </div>

      <div className="rounded-xl border border-border/70 bg-card/40 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-muted-foreground uppercase tracking-wider text-[10px]">
            <tr className="border-b border-border/60">
              <th className="text-left p-2">Category</th>
              <th className="text-right p-2">Signals</th>
              <th className="text-right p-2">Target hits</th>
              <th className="text-right p-2">Invalidated</th>
              <th className="text-right p-2">Hit rate</th>
              <th className="text-right p-2">Avg move</th>
            </tr>
          </thead>
          <tbody>
            {Array.from(catMap.entries()).map(([cat, rec]) => {
              const closedN = rec.targets + rec.invalidated;
              const hr = closedN > 0 ? (rec.targets / closedN) * 100 : null;
              const avg =
                rec.moves.length > 0
                  ? rec.moves.reduce((a, b) => a + b, 0) / rec.moves.length
                  : null;
              return (
                <tr key={cat} className="border-b border-border/40 last:border-b-0">
                  <td className="p-2">{cat}</td>
                  <td className="p-2 text-right tabular-nums">{rec.total}</td>
                  <td className="p-2 text-right tabular-nums text-tailwind">{rec.targets}</td>
                  <td className="p-2 text-right tabular-nums text-headwind">{rec.invalidated}</td>
                  <td className="p-2 text-right tabular-nums">
                    {hr == null ? "—" : hr.toFixed(0) + "%"}
                  </td>
                  <td className={"p-2 text-right tabular-nums " + pctTone(avg)}>
                    {fmtPct(avg)}
                  </td>
                </tr>
              );
            })}
            {catMap.size === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
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
}: {
  title: string;
  rows: {
    signal: { id: string; ticker: string; direction: "long" | "short" };
    event?: { headline: string };
    metrics: { currentPct: number | null };
  }[];
  tone: "tailwind" | "headwind";
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-card/40 p-4">
      <h3 className={"text-xs font-semibold uppercase tracking-wider mb-2 text-" + tone}>
        {title}
      </h3>
      <div className="space-y-1.5">
        {rows.length === 0 && <div className="text-xs text-muted-foreground">—</div>}
        {rows.map((r) => (
          <Link
            key={r.signal.id}
            to="/signal/$id"
            params={{ id: r.signal.id }}
            className="flex items-center gap-2 text-xs hover:bg-background/40 rounded px-1.5 py-1"
          >
            <span className="font-mono font-semibold">{r.signal.ticker}</span>
            <span className="flex-1 truncate text-muted-foreground">
              {r.event?.headline ?? ""}
            </span>
            <span className={"font-mono tabular-nums " + pctTone(r.metrics.currentPct)}>
              {fmtPct(r.metrics.currentPct)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
