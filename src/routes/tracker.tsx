import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { SiteShell } from "@/components/site-shell";
import { ensureSignals, listSignals } from "@/lib/signals.functions";
import { computeMetrics, fmtPct, fmtPrice, pctTone } from "@/lib/signal-metrics";
import { type EventCategory } from "@/lib/ripple-data";
import { useLiveEvents } from "@/hooks/use-live-events";
import { useWatchlist } from "@/lib/watchlist-store";
import { RefreshCw } from "lucide-react";

export const Route = createFileRoute("/tracker")({
  head: () => ({
    meta: [
      { title: "Signal Tracker — The Ripple Effect" },
      {
        name: "description",
        content:
          "Tracker dashboard for hypothetical stock signals linked to world events. Educational only, delayed prices.",
      },
      { property: "og:title", content: "Signal Tracker — The Ripple Effect" },
      {
        property: "og:description",
        content: "Observe how tickers behaved after each ripple event.",
      },
    ],
  }),
  component: TrackerPage,
});

type SortKey =
  | "ticker"
  | "direction"
  | "signal_price"
  | "current"
  | "high"
  | "low"
  | "pct"
  | "status"
  | "date";

function TrackerPage() {
  const list = useServerFn(listSignals);
  const seed = useServerFn(ensureSignals);
  const qc = useQueryClient();
  const { data } = useSuspenseQuery({
    queryKey: ["signals", "all"],
    queryFn: () => list(),
    staleTime: 30_000,
  });

  const seedMut = useMutation({
    mutationFn: () => seed(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["signals"] }),
  });

  const watchlist = useWatchlist();
  const [status, setStatus] = useState<"all" | "open" | "closed">("all");
  const [direction, setDirection] = useState<"all" | "long" | "short">("all");
  const [category, setCategory] = useState<"all" | EventCategory>("all");
  const [onlyWatchlist, setOnlyWatchlist] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("pct");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { events: liveEvents } = useLiveEvents();
  const eventById = useMemo(
    () => new Map(liveEvents.map((e) => [e.id, e])),
    [liveEvents],
  );

  const rows = useMemo(() => {
    const enriched = data.signals.map((s) => {
      const snap = data.latest[s.id];
      const currentPrice = snap ? snap.price : null;
      const virtualSnapshots = currentPrice != null
        ? [{ price: currentPrice, captured_at: snap!.captured_at }]
        : [];
      const m = computeMetrics(s, virtualSnapshots);
      const event = eventById.get(s.event_id);
      return { signal: s, event, currentPrice, metrics: m };
    });
    return enriched
      .filter((r) => (status === "all" ? true : r.signal.status === status))
      .filter((r) => (direction === "all" ? true : r.signal.direction === direction))
      .filter((r) =>
        category === "all" ? true : r.event?.category === category,
      )
      .filter((r) =>
        !onlyWatchlist ? true : watchlist.includes(r.signal.ticker.toUpperCase()),
      )
      .sort((a, b) => {
        const dir = sortDir === "asc" ? 1 : -1;
        switch (sortKey) {
          case "ticker":
            return a.signal.ticker.localeCompare(b.signal.ticker) * dir;
          case "direction":
            return a.signal.direction.localeCompare(b.signal.direction) * dir;
          case "signal_price":
            return ((a.signal.signal_price ?? 0) - (b.signal.signal_price ?? 0)) * dir;
          case "current":
            return ((a.currentPrice ?? 0) - (b.currentPrice ?? 0)) * dir;
          case "high":
            return ((a.metrics.runningHigh ?? 0) - (b.metrics.runningHigh ?? 0)) * dir;
          case "low":
            return ((a.metrics.runningLow ?? 0) - (b.metrics.runningLow ?? 0)) * dir;
          case "status":
            return a.signal.status.localeCompare(b.signal.status) * dir;
          case "date":
            return (
              (new Date(a.signal.signal_timestamp).getTime() -
                new Date(b.signal.signal_timestamp).getTime()) *
              dir
            );
          case "pct":
          default:
            return ((a.metrics.currentPct ?? -Infinity) - (b.metrics.currentPct ?? -Infinity)) * dir;
        }
      });
  }, [data, status, direction, category, onlyWatchlist, sortKey, sortDir, eventById, watchlist]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(k);
      setSortDir("desc");
    }
  }

  const empty = data.signals.length === 0;

  return (
    <SiteShell>
      <div className="mb-4 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Signal Tracker
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Hypothetical signals auto-generated from ripple events. Educational
            historical correlation only — delayed prices, no advice.
          </p>
        </div>
        <button
          onClick={() => seedMut.mutate()}
          disabled={seedMut.isPending}
          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border/70 bg-card/60 hover:bg-card transition-colors disabled:opacity-50"
        >
          <RefreshCw className={"w-3.5 h-3.5 " + (seedMut.isPending ? "animate-spin" : "")} />
          {empty ? "Generate signals" : "Refresh signals"}
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Select label="Status" value={status} onChange={(v) => setStatus(v as typeof status)}
          options={[["all", "All"], ["open", "Open"], ["closed", "Closed"]]} />
        <Select label="Direction" value={direction} onChange={(v) => setDirection(v as typeof direction)}
          options={[["all", "All"], ["long", "Long"], ["short", "Short"]]} />
        <Select label="Category" value={category} onChange={(v) => setCategory(v as typeof category)}
          options={[
            ["all", "All"],
            ...(["Geopolitical", "Central Bank", "Commodity", "Regulation", "Tech", "Weather/Disaster"] as EventCategory[]).map(
              (c) => [c, c] as [string, string],
            ),
          ]}
        />
        <label className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-md border border-border/70 bg-card/60 cursor-pointer">
          <input
            type="checkbox"
            checked={onlyWatchlist}
            onChange={(e) => setOnlyWatchlist(e.target.checked)}
            className="accent-primary"
          />
          Watchlist only
        </label>
      </div>

      {empty ? (
        <div className="rounded-xl border border-dashed border-border/70 bg-card/40 p-8 text-center text-sm text-muted-foreground">
          No signals tracked yet.{" "}
          <button
            onClick={() => seedMut.mutate()}
            className="text-primary hover:underline"
            disabled={seedMut.isPending}
          >
            Generate signals from today's events
          </button>{" "}
          to start observing price behaviour.
        </div>
      ) : (
        <div className="rounded-xl border border-border/70 bg-card/40 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground uppercase tracking-wider text-[10px]">
              <tr className="border-b border-border/60">
                <Th onClick={() => toggleSort("ticker")}>Ticker</Th>
                <Th>Event</Th>
                <Th onClick={() => toggleSort("direction")}>Dir</Th>
                <Th onClick={() => toggleSort("signal_price")} right>Signal</Th>
                <Th onClick={() => toggleSort("current")} right>Current</Th>
                <Th onClick={() => toggleSort("high")} right>High</Th>
                <Th onClick={() => toggleSort("low")} right>Low</Th>
                <Th onClick={() => toggleSort("pct")} right>% Move</Th>
                <Th onClick={() => toggleSort("status")}>Status</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ signal, event, currentPrice, metrics }) => (
                <tr
                  key={signal.id}
                  className="border-b border-border/40 last:border-b-0 hover:bg-background/40"
                >
                  <td className="p-2 font-mono font-semibold">
                    <Link to="/signal/$id" params={{ id: signal.id }} className="hover:text-primary">
                      {signal.ticker}
                    </Link>
                  </td>
                  <td className="p-2 max-w-[220px] truncate text-muted-foreground">
                    {event ? (
                      <Link to="/event/$id" params={{ id: event.id }} className="hover:text-primary">
                        {event.headline}
                      </Link>
                    ) : (
                      signal.event_id
                    )}
                  </td>
                  <td className="p-2">
                    <span
                      className={
                        "text-[10px] font-medium px-1.5 py-0.5 rounded border " +
                        (signal.direction === "long"
                          ? "border-tailwind/40 text-tailwind bg-tailwind/10"
                          : "border-headwind/40 text-headwind bg-headwind/10")
                      }
                    >
                      {signal.direction === "long" ? "LONG" : "SHORT"}
                    </span>
                  </td>
                  <td className="p-2 text-right font-mono tabular-nums">{fmtPrice(signal.signal_price)}</td>
                  <td className="p-2 text-right font-mono tabular-nums">{fmtPrice(currentPrice)}</td>
                  <td className="p-2 text-right font-mono tabular-nums text-muted-foreground">
                    {fmtPrice(metrics.runningHigh)}
                  </td>
                  <td className="p-2 text-right font-mono tabular-nums text-muted-foreground">
                    {fmtPrice(metrics.runningLow)}
                  </td>
                  <td className={"p-2 text-right font-mono tabular-nums " + pctTone(metrics.currentPct)}>
                    {fmtPct(metrics.currentPct)}
                  </td>
                  <td className="p-2">
                    <span
                      className={
                        "text-[10px] uppercase tracking-wider " +
                        (signal.status === "open"
                          ? "text-foreground"
                          : signal.close_reason === "target"
                          ? "text-tailwind"
                          : "text-headwind")
                      }
                    >
                      {signal.status === "open"
                        ? "Open"
                        : signal.close_reason === "target"
                        ? "Target hit"
                        : "Invalidated"}
                    </span>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-muted-foreground">
                    No signals match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </SiteShell>
  );
}

function Th({
  children,
  onClick,
  right,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  right?: boolean;
}) {
  return (
    <th
      onClick={onClick}
      className={
        "p-2 font-medium " +
        (right ? "text-right " : "text-left ") +
        (onClick ? "cursor-pointer select-none hover:text-foreground" : "")
      }
    >
      {children}
    </th>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="inline-flex items-center gap-2 text-xs px-2 py-1 rounded-md border border-border/70 bg-card/60">
      <span className="text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent outline-none text-foreground"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v} className="bg-background">
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
