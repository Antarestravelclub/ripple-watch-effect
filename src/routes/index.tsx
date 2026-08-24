import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteShell } from "@/components/site-shell";
import { EventCard } from "@/components/event-card";
import { RegionFilter } from "@/components/region-filter";
import { TickerSearch, eventTouchesTicker } from "@/components/ticker-search";
import { MarketMovers } from "@/components/market-movers";
import { TopSetupsStrip } from "@/components/top-setups-strip";
import { QuoteCard } from "@/components/quote-card";
import { eventMatchesRegions, type RegionCode } from "@/lib/ripple-regions";
import { isStale, sortByStrengthThenRecency, STALE_AFTER_HOURS } from "@/lib/event-freshness";
import { ChevronDown, RefreshCw, AlertTriangle } from "lucide-react";
import { useLiveEvents } from "@/hooks/use-live-events";
import { refreshNewsFeed } from "@/lib/live-events.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Today's Ripples — The Ripple Effect" },
      {
        name: "description",
        content:
          "A live map of world events and the stocks and sectors they mechanically affect, refreshed every 15 minutes. Filter by region and see which tickers are exposed.",
      },
      { property: "og:title", content: "Today's Ripples — The Ripple Effect" },
      {
        property: "og:description",
        content:
          "Map breaking world events to the sectors and tickers they touch. Exposure and historical context, not price predictions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TodayPage,
});

function IngestStatus() {
  const { events, lastIngest, isLoading, error, refetch } = useLiveEvents();
  const queryClient = useQueryClient();
  const runRefresh = useServerFn(refreshNewsFeed);
  const [refreshing, setRefreshing] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const at = lastIngest?.finished_at ?? lastIngest?.started_at ?? null;
  const failed = lastIngest ? !lastIngest.ok : false;
  const quiet =
    lastIngest?.ok && lastIngest.events_created === 0 && !lastIngest.error;
  const newestPub = events.reduce(
    (max, e) => Math.max(max, new Date(e.publishedAt).getTime()),
    0,
  );
  const feedAgeH =
    newestPub > 0 ? (Date.now() - newestPub) / 3_600_000 : null;
  const feedLagging = feedAgeH != null && feedAgeH > 6;

  const refreshNow = async () => {
    setRefreshing(true);
    setNote(null);
    try {
      const r = await runRefresh();
      setNote(
        r.ok
          ? r.eventsCreated > 0
            ? `${r.eventsCreated} new event${r.eventsCreated === 1 ? "" : "s"}, ${r.signalsCreated} signal${r.signalsCreated === 1 ? "" : "s"}`
            : "Checked — no new market-moving headlines"
          : (r.error ?? "Refresh failed"),
      );
      await queryClient.invalidateQueries({ queryKey: ["live-events"] });
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="mb-4 flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
      <span
        className={
          "w-1.5 h-1.5 rounded-full " +
          (failed || error
            ? "bg-headwind"
            : quiet
              ? "bg-amber-400"
              : at
                ? "bg-tailwind animate-pulse"
                : "bg-muted")
        }
      />
      <span>
        {isLoading
          ? "Loading the live feed…"
          : at
            ? `News refreshed ${new Date(at).toLocaleTimeString()} · auto-refresh every 15 min`
            : "Waiting for the first news refresh…"}
      </span>
      {(failed || error) && (
        <span className="inline-flex items-center gap-1 text-headwind">
          <AlertTriangle className="h-3 w-3" />
          {error ?? lastIngest?.error ?? "Last refresh failed"}
        </span>
      )}
      {!failed && !error && feedLagging && (
        <span className="inline-flex items-center gap-1 text-amber-400">
          <AlertTriangle className="h-3 w-3" />
          Newest ripple is {Math.round(feedAgeH!)}h old — hit Refresh now to pull
          the latest headlines
        </span>
      )}
      {note && !failed && !error && <span className="text-foreground/80">{note}</span>}
      <div className="ml-auto flex items-center gap-1.5">
        <button
          type="button"
          onClick={refreshNow}
          disabled={refreshing}
          className="inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-1 hover:text-foreground hover:bg-card/60 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={"h-3 w-3 " + (refreshing ? "animate-spin" : "")} />
          {refreshing ? "Refreshing…" : "Refresh now"}
        </button>
        <button
          type="button"
          onClick={() => refetch()}
          className="inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-1 hover:text-foreground hover:bg-card/60 transition-colors"
        >
          Reload feed
        </button>
      </div>
    </div>
  );
}

function TodayPage() {
  const [regions, setRegions] = useState<RegionCode[]>([]);
  const [query, setQuery] = useState("");
  const [showOlder, setShowOlder] = useState(false);
  const { events: liveEvents, isLoading } = useLiveEvents();

  const events = sortByStrengthThenRecency(liveEvents)
    .filter((e) => eventMatchesRegions(e.id, regions))
    .filter((e) => eventTouchesTicker(e, query));

  const fresh = events.filter((e) => !isStale(e.publishedAt));
  const older = events.filter((e) => isStale(e.publishedAt));

  return (
    <SiteShell>
      <div className="mb-4">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          Today's Ripples
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Live world events, mapped to the sectors and tickers they mechanically
          touch.
        </p>
      </div>

      <IngestStatus />

      <div className="mb-4">
        <TickerSearch query={query} onChange={setQuery} events={liveEvents} />
      </div>

      {query.trim().length > 0 && <QuoteCard ticker={query} />}

      <MarketMovers />

      <TopSetupsStrip events={liveEvents} />

      <div className="mb-5">
        <RegionFilter selected={regions} onChange={setRegions} />
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-border/70 bg-card/60 p-8 text-center text-sm text-muted-foreground">
          Loading the latest ripples…
        </div>
      ) : liveEvents.length === 0 ? (
        <div className="rounded-xl border border-border/70 bg-card/60 p-8 text-center text-sm text-muted-foreground">
          No events ingested yet. The news refresh runs every 15 minutes — reload
          the feed shortly.
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-xl border border-border/70 bg-card/60 p-8 text-center text-sm text-muted-foreground">
          No events match the selected filters.
        </div>
      ) : (
        <>
          {fresh.length > 0 ? (
            <div className="grid gap-3">
              {fresh.map((e) => (
                <EventCard key={e.id} event={e} />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-border/60 bg-card/40 p-6 text-center text-sm text-muted-foreground">
              Nothing newer than {STALE_AFTER_HOURS}h right now — see older
              ripples below.
            </div>
          )}

          {older.length > 0 && (
            <div className="mt-6">
              <button
                type="button"
                onClick={() => setShowOlder((v) => !v)}
                className="w-full flex items-center justify-between gap-2 rounded-lg border border-border/50 bg-card/30 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-card/50 transition-colors"
                aria-expanded={showOlder}
              >
                <span className="uppercase tracking-wider">
                  Older ripples · {older.length} over {STALE_AFTER_HOURS}h
                </span>
                <ChevronDown
                  className={
                    "h-4 w-4 transition-transform " +
                    (showOlder || fresh.length === 0 ? "rotate-180" : "")
                  }
                />
              </button>
              {(showOlder || fresh.length === 0) && (
                <div className="grid gap-3 mt-3">
                  {older.map((e) => (
                    <EventCard key={e.id} event={e} stale />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </SiteShell>
  );
}
