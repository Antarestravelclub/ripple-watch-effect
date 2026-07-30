import { Link } from "@tanstack/react-router";
import { Suspense } from "react";
import type { RippleEvent } from "@/lib/ripple-data";
import { eventTouchesTicker } from "@/lib/ripple-data";
import { useWatchlist } from "@/lib/watchlist-store";
import { CategoryBadge, StrengthPill } from "./badges";
import { REGIONS, eventRegions } from "@/lib/ripple-regions";
import { EventSignals } from "./event-signals";
import { LivePicks } from "./live-picks";
import { ageLabel, ageHours, STALE_AFTER_HOURS } from "@/lib/event-freshness";


export function EventCard({
  event,
  stale = false,
}: {
  event: RippleEvent;
  stale?: boolean;
}) {
  const watchlist = useWatchlist();
  const hit = watchlist.find((t) => eventTouchesTicker(event, t));

  return (
    <Link
      to="/event/$id"
      params={{ id: event.id }}
      className={
        "group block rounded-xl border transition-all p-4 " +
        (stale
          ? "border-border/40 bg-card/25 opacity-60 hover:opacity-100 hover:bg-card/50"
          : "border-border/70 bg-card/60 hover:bg-card hover:border-primary/40")
      }
    >
      <div className="flex items-center gap-2 flex-wrap">
        <CategoryBadge category={event.category} />
        <StrengthPill strength={event.strength} />
        <span className="inline-flex items-center gap-0.5 text-sm leading-none" title="Regions">
          {eventRegions(event.id).map((code) => {
            const r = REGIONS.find((x) => x.code === code);
            return r ? <span key={code} title={r.label}>{r.flag}</span> : null;
          })}
        </span>
        {hit && (
          <span className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">
            Ripples your holdings • {hit}
          </span>
        )}
        <span className="ml-auto flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span>{event.source}</span>
          <span
            className={
              "px-1.5 py-px rounded-full border tabular-nums " +
              (ageHours(event.publishedAt) < STALE_AFTER_HOURS
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border/50 text-muted-foreground")
            }
          >
            {ageLabel(event.publishedAt)}
          </span>
        </span>
      </div>
      <h3 className="mt-3 text-base sm:text-lg font-semibold leading-snug text-foreground group-hover:text-primary transition-colors">
        {event.headline}
      </h3>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {event.whyMarketsCare}
      </p>
      <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-tailwind" />
          {event.tailwinds.reduce((a, b) => a + b.tickers.length, 0)} tailwind
          tickers
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-headwind" />
          {event.headwinds.reduce((a, b) => a + b.tickers.length, 0)} headwind
          tickers
        </span>
      </div>
      <LivePicks eventId={event.id} compact />
      <Suspense fallback={null}>
        <EventSignals eventId={event.id} strength={event.strength} />
      </Suspense>

    </Link>
  );
}
