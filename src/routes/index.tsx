import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SiteShell } from "@/components/site-shell";
import { EventCard } from "@/components/event-card";
import { EVENTS } from "@/lib/ripple-data";
import { RegionFilter } from "@/components/region-filter";
import { TickerSearch, eventTouchesTicker } from "@/components/ticker-search";
import { MarketMovers } from "@/components/market-movers";
import { eventMatchesRegions, type RegionCode } from "@/lib/ripple-regions";


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

  const events = [...EVENTS]
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    )
    .filter((e) => eventMatchesRegions(e.id, regions))
    .filter((e) => eventTouchesTicker(e, query));

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
        <div className="grid gap-3">
          {events.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
      )}
    </SiteShell>
  );
}
