import { createFileRoute } from "@tanstack/react-router";
import { SiteShell } from "@/components/site-shell";
import { eventTouchesTicker } from "@/lib/ripple-data";
import { useLiveEvents } from "@/hooks/use-live-events";
import {
  addTicker,
  removeTicker,
  useWatchlist,
} from "@/lib/watchlist-store";
import { EventCard } from "@/components/event-card";
import { useState } from "react";
import { X } from "lucide-react";
import { WatchlistQuotes } from "@/components/watchlist-quotes";
import { useEtfTickers } from "@/hooks/use-etf-tickers";
import { EtfBadge } from "@/components/etf-badge";
import { matchesInstrument, INSTRUMENT_LABEL, type InstrumentFilter } from "@/lib/instrument";

export const Route = createFileRoute("/watchlist")({
  head: () => ({
    meta: [
      { title: "Watchlist — The Ripple Effect" },
      {
        name: "description",
        content:
          "Track tickers and see which of today's events ripple through your holdings.",
      },
      { property: "og:title", content: "Watchlist — The Ripple Effect" },
      {
        property: "og:description",
        content:
          "Track tickers and see which of today's events ripple through your holdings.",
      },
    ],
  }),
  component: WatchlistPage,
});

function WatchlistPage() {
  const watchlist = useWatchlist();
  const { events } = useLiveEvents();
  const [input, setInput] = useState("");
  const [instrument, setInstrument] = useState<InstrumentFilter>("all");
  const { instrumentOf } = useEtfTickers();
  const shown = watchlist.filter((t) => matchesInstrument(instrument, instrumentOf(t)));

  const relevant = events.filter((e) =>
    shown.some((t) => eventTouchesTicker(e, t)),
  ).sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );

  return (
    <SiteShell>
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          My Watchlist
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Add tickers to surface events that ripple through your holdings.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          addTicker(input);
          setInput("");
        }}
        className="flex gap-2 mb-4"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Add ticker (e.g. NVDA)"
          className="flex-1 bg-background/60 border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        <button
          type="submit"
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
        >
          Add
        </button>
      </form>

      {watchlist.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1 text-xs">
          <span className="text-muted-foreground mr-1">Show</span>
          {(
            [
              ["all", "All"],
              ["stock", INSTRUMENT_LABEL.stock],
              ["etf", INSTRUMENT_LABEL.etf],
            ] as Array<[InstrumentFilter, string]>
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setInstrument(key)}
              className={
                "rounded-md border px-2 py-1 transition-colors " +
                (instrument === key
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border/70 text-muted-foreground hover:bg-accent")
              }
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {watchlist.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {shown.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 text-xs font-mono font-medium px-2 py-1 rounded-md border border-primary/40 bg-primary/10 text-primary"
            >
              {t}
              <EtfBadge type={instrumentOf(t)} />
              <button
                onClick={() => removeTicker(t)}
                className="opacity-70 hover:opacity-100"
                aria-label={`Remove ${t}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <WatchlistQuotes tickers={shown} />



      {watchlist.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Your watchlist is empty. Add a ticker above, or tap a ticker on any
          event to add it.
        </div>
      ) : relevant.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          None of today's events touch your watchlist.
        </div>
      ) : (
        <>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Ripples your holdings
          </h2>
          <div className="grid gap-3">
            {relevant.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        </>
      )}
    </SiteShell>
  );
}
