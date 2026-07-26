import { Link } from "@tanstack/react-router";
import { Suspense } from "react";
import type { RippleEvent } from "@/lib/ripple-data";
import { eventTouchesTicker } from "@/lib/ripple-data";
import { useWatchlist } from "@/lib/watchlist-store";
import { CategoryBadge, StrengthPill } from "./badges";
import { REGIONS, eventRegions } from "@/lib/ripple-regions";
import { EventSignals } from "./event-signals";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function EventCard({ event }: { event: RippleEvent }) {
  const watchlist = useWatchlist();
  const hit = watchlist.find((t) => eventTouchesTicker(event, t));

  return (
    <Link
      to="/event/$id"
      params={{ id: event.id }}
      className="group block rounded-xl border border-border/70 bg-card/60 hover:bg-card hover:border-primary/40 transition-all p-4"
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
        <span className="ml-auto text-[11px] text-muted-foreground">
          {event.source} · {timeAgo(event.publishedAt)}
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
      <Suspense fallback={null}>
        <EventSignals eventId={event.id} />
      </Suspense>
    </Link>
  );
}
