import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell } from "@/components/site-shell";
import { useTickerRollups } from "@/hooks/use-ticker-rollups";
import { useLiveQuotes } from "@/hooks/use-live-quotes";
import {
  combinedMovePct,
  CONFLICT_NOTE,
  STANCE_CLASS,
  STANCE_LABEL,
} from "@/lib/ticker-rollup";
import { fmtPct, pctTone } from "@/lib/signal-metrics";
import { TickerLabel } from "@/components/ticker-meta-chips";
import { useLiveEvents } from "@/hooks/use-live-events";

export const Route = createFileRoute("/tickers/$symbol")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.symbol} exposure — The Ripple Effect` },
      {
        name: "description",
        content: `Active ripple signals on ${params.symbol}, the events driving them, and whether exposures conflict.`,
      },
      { property: "og:title", content: `${params.symbol} exposure — The Ripple Effect` },
      {
        property: "og:description",
        content: `Events driving active ${params.symbol} signals. Educational research only.`,
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TickerDetail,
});

function TickerDetail() {
  const { symbol } = Route.useParams();
  const { rows, isLoading } = useTickerRollups();
  const row = rows.find((r) => r.ticker.toUpperCase() === symbol.toUpperCase());
  const { quotes } = useLiveQuotes(row ? [row.quoteSymbol] : []);
  const { events } = useLiveEvents();
  const eventById = new Map(events.map((e) => [e.id, e]));

  if (!row) {
    return (
      <SiteShell>
        <h1 className="text-2xl font-semibold tracking-tight">{symbol}</h1>
        <p className="text-sm text-muted-foreground mt-2">
          {isLoading ? "Loading…" : "No active signals for this ticker."}
        </p>
        <Link to="/tickers" className="text-sm text-primary hover:underline mt-3 inline-block">
          ← All tickers
        </Link>
      </SiteShell>
    );
  }

  const price = quotes[row.quoteSymbol]?.price ?? null;
  const move = combinedMovePct(row, price);

  return (
    <SiteShell>
      <Link to="/tickers" className="text-xs text-primary hover:underline">
        ← All tickers
      </Link>
      <div className="mt-2 mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight font-mono">
          <TickerLabel ticker={row.ticker} />
        </h1>
        <span
          className={
            "rounded border px-2 py-0.5 text-[11px] font-mono " + STANCE_CLASS[row.stance]
          }
        >
          {STANCE_LABEL[row.stance]}
        </span>
        <span className={"font-mono tabular-nums text-sm " + pctTone(move)}>
          {fmtPct(move, 1)} since earliest snapshot
        </span>
      </div>

      {row.stance === "conflicted" && (
        <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground mb-4">
          {CONFLICT_NOTE} {row.activeLong} active long signal(s) and {row.activeShort}{" "}
          active short signal(s) point in opposite directions on this name.
        </div>
      )}

      <div className="rounded-xl border border-border/70 bg-card/40 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-muted-foreground uppercase tracking-wider text-[10px]">
            <tr className="border-b border-border/60">
              <th className="text-left p-2">Event</th>
              <th className="text-left p-2">Direction</th>
              <th className="text-right p-2">Snapshot</th>
              <th className="text-right p-2">Move</th>
            </tr>
          </thead>
          <tbody>
            {row.signals.map((s) => {
              const ev = eventById.get(s.event_id);
              const raw =
                s.signal_price && price != null
                  ? ((price - s.signal_price) / s.signal_price) * 100
                  : null;
              const dirPct =
                raw == null ? null : s.direction === "long" ? raw : -raw;
              return (
                <tr key={s.id} className="border-b border-border/40 last:border-b-0">
                  <td className="p-2">
                    {ev ? (
                      <Link
                        to="/event/$id"
                        params={{ id: ev.id }}
                        className="hover:underline"
                      >
                        {ev.headline}
                      </Link>
                    ) : (
                      s.event_id
                    )}
                  </td>
                  <td className="p-2">
                    <Link
                      to="/signal/$id"
                      params={{ id: s.id }}
                      className={
                        "rounded border px-1.5 py-0.5 text-[10px] font-mono " +
                        (s.direction === "long"
                          ? "bg-tailwind/15 text-tailwind border-tailwind/30"
                          : "bg-headwind/15 text-headwind border-headwind/30")
                      }
                    >
                      {s.direction === "long" ? "LONG" : "SHORT"}
                    </Link>
                  </td>
                  <td className="p-2 text-right tabular-nums font-mono">
                    {s.signal_price == null ? "—" : s.signal_price.toFixed(2)}
                  </td>
                  <td className={"p-2 text-right tabular-nums font-mono " + pctTone(dirPct)}>
                    {fmtPct(dirPct, 1)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground mt-3">
        Delayed prices. Educational research only — not investment advice.
      </p>
    </SiteShell>
  );
}
