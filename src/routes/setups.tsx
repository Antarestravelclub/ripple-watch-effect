import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { SiteShell } from "@/components/site-shell";
import { SetupCard } from "@/components/setup-card";
import { listSignals } from "@/lib/signals.functions";
import { useLiveEvents } from "@/hooks/use-live-events";
import { useLiveQuotes, statusLabel } from "@/hooks/use-live-quotes";
import { useTickerRollups } from "@/hooks/use-ticker-rollups";
import { useWatchlist } from "@/lib/watchlist-store";
import { buildSetups, dedupeByTicker } from "@/lib/swing-setups";
import { RegionFilter } from "@/components/region-filter";
import { eventMatchesRegions, type RegionCode } from "@/lib/ripple-regions";

type RankMode = "opportunity" | "remaining" | "score" | "increase" | "decrease" | "newest";

const rankDescriptions: Record<RankMode, string> = {
  opportunity: "Balances setup quality, remaining target distance, freshness, conflicts and invalidation risk.",
  remaining: "Largest favorable percentage still available before the mechanical target.",
  score: "Highest existing setup-quality score first.",
  increase: "Largest actual price increase since the event was mapped.",
  decrease: "Largest actual price decrease since the event was mapped.",
  newest: "Most recently mapped event first.",
};

function valueOrLast(value: number | null, fallback: number) {
  return value == null || !Number.isFinite(value) ? fallback : value;
}

function rankSetups(setups: ReturnType<typeof buildSetups>, mode: RankMode) {
  return [...setups].sort((a, b) => {
    if (mode === "opportunity") return b.opportunityRank - a.opportunityRank || b.score - a.score;
    if (mode === "remaining")
      return valueOrLast(b.remainingTargetPct, -Infinity) - valueOrLast(a.remainingTargetPct, -Infinity);
    if (mode === "score") return b.score - a.score;
    if (mode === "increase")
      return valueOrLast(b.actualMovePct, -Infinity) - valueOrLast(a.actualMovePct, -Infinity);
    if (mode === "decrease")
      return valueOrLast(a.actualMovePct, Infinity) - valueOrLast(b.actualMovePct, Infinity);
    return valueOrLast(a.eventAgeHours, Infinity) - valueOrLast(b.eventAgeHours, Infinity);
  });
}

export const Route = createFileRoute("/setups")({
  head: () => ({
    meta: [
      { title: "Swing Setups — The Ripple Effect" },
      {
        name: "description",
        content:
          "Ranked short-term scenario levels from today's news: entry zone, target, and invalidation derived from each event's mechanical exposure. Research only.",
      },
      { property: "og:title", content: "Swing Setups — The Ripple Effect" },
      {
        property: "og:description",
        content:
          "Entry zone, target, and exit levels mapped from live event magnitude — mechanical exposure, not predictions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SetupsPage,
});

function SetupsPage() {
  const list = useServerFn(listSignals);
  const { data, isLoading } = useQuery({
    queryKey: ["signals", "all"],
    queryFn: () => list(),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
  const { events } = useLiveEvents();
  const { rows: rollups } = useTickerRollups();
  const watchlist = useWatchlist();

  const [regions, setRegions] = useState<RegionCode[]>([]);
  const [direction, setDirection] = useState<"all" | "long" | "short">("all");
  const [minScore, setMinScore] = useState(50);
  const [onlyWatchlist, setOnlyWatchlist] = useState(false);
  const [hideCaptured, setHideCaptured] = useState(true);
  const [hideConflicted, setHideConflicted] = useState(true);
  const [onePerTicker, setOnePerTicker] = useState(true);
  const [rankBy, setRankBy] = useState<RankMode>("opportunity");

  const conflicted = useMemo(
    () => new Set(rollups.filter((r) => r.stance === "conflicted").map((r) => r.ticker.toUpperCase())),
    [rollups],
  );
  const eventMap = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);

  const symbols = useMemo(
    () =>
      (data?.signals ?? [])
        .filter((s) => s.status === "open")
        .map((s) => (s.quote_symbol || s.ticker).toUpperCase()),
    [data],
  );
  const quotes = useLiveQuotes(symbols);

  const setups = useMemo(() => {
    if (!data) return [];
    const all = buildSetups({
      signals: data.signals,
      latest: data.latest,
      events: eventMap,
      quotes: quotes.quotes,
      conflicted,
    });
    const filtered = all
      .filter((s) => (direction === "all" ? true : s.direction === direction))
      .filter((s) => s.score >= minScore)
      .filter((s) => (hideCaptured ? !s.captured : true))
      .filter((s) => (hideConflicted ? !s.conflicted : true))
      .filter((s) => (onlyWatchlist ? watchlist.includes(s.ticker.toUpperCase()) : true))
      .filter((s) =>
        regions.length === 0 || !s.event ? true : eventMatchesRegions(s.event.id, regions),
      );
    const unique = onePerTicker ? dedupeByTicker(filtered) : filtered;
    return rankSetups(unique, rankBy);
  }, [
    data,
    eventMap,
    quotes.quotes,
    conflicted,
    direction,
    minScore,
    hideCaptured,
    hideConflicted,
    onlyWatchlist,
    watchlist,
    regions,
    onePerTicker,
    rankBy,
  ]);

  return (
    <SiteShell>
      <div className="mb-4">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Swing Setups</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tickers mechanically exposed to today's news, ranked by how clean the short-term
          setup is. Each row shows an entry zone, a target from the event's expected move,
          and the level where the exposure thesis is treated as wrong.
        </p>
        <p className="text-[11px] text-muted-foreground mt-1">
          {statusLabel(quotes.status, {
            streaming: quotes.streaming,
            marketOpen: quotes.marketOpen,
            updatedAt: quotes.updatedAt,
          })}{" "}
          · Levels are mechanical scenarios, not predictions or advice.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-4">
        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap gap-2 items-center">
            <label className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-md border border-primary/50 bg-primary/10">
              Rank by
              <select
                value={rankBy}
                onChange={(e) => setRankBy(e.target.value as RankMode)}
                className="bg-transparent outline-none text-foreground"
                aria-label="Rank swing setups by"
              >
                <option value="opportunity">Best opportunity (risk-adjusted)</option>
                <option value="remaining">Biggest remaining gain to target</option>
                <option value="score">Highest setup score</option>
                <option value="increase">Highest actual % increase</option>
                <option value="decrease">Highest actual % decrease</option>
                <option value="newest">Newest event</option>
              </select>
            </label>
            <label className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-md border border-border/70 bg-card/60">
              Direction
              <select
                value={direction}
                onChange={(e) => setDirection(e.target.value as typeof direction)}
                className="bg-transparent outline-none text-foreground"
              >
                <option value="all">All</option>
                <option value="long">Tailwind (long)</option>
                <option value="short">Headwind (short)</option>
              </select>
            </label>
            <label className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-md border border-border/70 bg-card/60">
              Min score {minScore}
              <input
                type="range"
                min={0}
                max={90}
                step={5}
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value))}
                className="accent-primary w-24"
              />
            </label>
            <Toggle checked={hideCaptured} onChange={setHideCaptured} label="Hide priced-in" />
            <Toggle checked={hideConflicted} onChange={setHideConflicted} label="Hide conflicted" />
            <Toggle checked={onlyWatchlist} onChange={setOnlyWatchlist} label="Watchlist only" />
            <Toggle checked={onePerTicker} onChange={setOnePerTicker} label="One row per ticker" />
          </div>
          <p className="mb-4 text-[11px] text-muted-foreground" aria-live="polite">
            {rankDescriptions[rankBy]} Mechanical comparison only—not a recommendation to invest.
          </p>

          {isLoading ? (
            <div className="rounded-xl border border-border/70 bg-card/40 p-8 text-center text-sm text-muted-foreground">
              Loading setups…
            </div>
          ) : setups.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 bg-card/40 p-8 text-center text-sm text-muted-foreground">
              No setups match these filters. Lower the minimum score or allow priced-in names.
            </div>
          ) : (
            <div className="space-y-3">
              {setups.map((s) => (
                <SetupCard key={s.signal.id} setup={s} />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <RegionFilter selected={regions} onChange={setRegions} />
          <div className="rounded-xl border border-border/70 bg-card/60 p-3 text-[11px] text-muted-foreground space-y-2">
            <p className="text-foreground text-xs font-semibold">How the score works</p>
            <p>Freshness of the event, ripple magnitude, exposure confidence, how much of the expected move is still untravelled, days left in the tracked window.</p>
            <p>Conflicted names, missing quotes, and non-US primary listings are marked down.</p>
            <p>Nothing here forecasts price. Verify liquidity and borrow availability yourself.</p>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-md border border-border/70 bg-card/60 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-primary"
      />
      {label}
    </label>
  );
}
