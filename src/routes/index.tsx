import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SiteShell } from "@/components/site-shell";
import { EventCard } from "@/components/event-card";
import { EVENTS } from "@/lib/ripple-data";
import { RegionFilter } from "@/components/region-filter";
import { TickerSearch, eventTouchesTicker } from "@/components/ticker-search";
import { MarketMovers } from "@/components/market-movers";
import { QuoteCard } from "@/components/quote-card";
import { eventMatchesRegions, type RegionCode } from "@/lib/ripple-regions";
import { isStale, sortByStrengthThenRecency, STALE_AFTER_HOURS } from "@/lib/event-freshness";
import { ChevronDown } from "lucide-react";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Today's Ripples — The Ripple Effect" },
      {
        name: "description",
        content:
          "A daily map of world events and the stocks and sectors they mechanically affect. Filter by region and see which tickers are best positioned.",
      },
      { property: "og:title", content: "Today's Ripples — The Ripple Effect" },
      {
        property: "og:description",
        content:
          "Map world events to the sectors and tickers they touch. Exposure and historical context, not price predictions.",
      },
    ],
  }),
  component: TodayPage,
});

function TodayPage() {
  const [regions, setRegions] = useState<RegionCode[]>([]);
  const [query, setQuery] = useState("");
  const [showOlder, setShowOlder] = useState(false);

  const events = sortByStrengthThenRecency(EVENTS)
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
          World events, mapped to the sectors and tickers they mechanically
          touch.
        </p>
      </div>

      <div className="mb-4">
        <TickerSearch query={query} onChange={setQuery} />
      </div>

      {query.trim().length > 0 && <QuoteCard ticker={query} />}

      <MarketMovers />


      <div className="mb-5">
        <RegionFilter selected={regions} onChange={setRegions} />
      </div>

      {events.length === 0 ? (
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
                    "h-4 w-4 transition-transform " + (showOlder || fresh.length === 0 ? "rotate-180" : "")
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
