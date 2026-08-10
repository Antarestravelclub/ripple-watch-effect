import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { TrendingUp, TrendingDown } from "lucide-react";
import { listSignals } from "@/lib/signals.functions";
import { fmtPct, fmtPrice, pctTone } from "@/lib/signal-metrics";
import { statusLabel, useLiveQuotes } from "@/hooks/use-live-quotes";

interface Mover {
  id: string;
  ticker: string;
  price: number;
  pct: number;
}

/** Snapshots older than this are treated as stale and excluded. */
const MAX_SNAPSHOT_AGE_MS = 24 * 60 * 60 * 1000;

export function MarketMovers() {
  const list = useServerFn(listSignals);
  const { data, isLoading } = useQuery({
    queryKey: ["signals", "all"],
    queryFn: () => list(),
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  // Only open signals with a recent snapshot qualify as "live" moves.
  const tracked = useMemo(() => {
    const cutoff = Date.now() - MAX_SNAPSHOT_AGE_MS;
    return (data?.signals ?? []).filter((s) => {
      if (s.status !== "open" || !s.signal_price) return false;
      const snap = data?.latest[s.id];
      if (!snap) return false;
      return new Date(snap.captured_at).getTime() >= cutoff;
    });
  }, [data]);

  const symbols = useMemo(
    () => tracked.map((s) => (s.quote_symbol || s.ticker).toUpperCase()),
    [tracked],
  );
  const { quotes, streaming, marketOpen, status, updatedAt } = useLiveQuotes(symbols);

  const { gainers, decliners } = useMemo(() => {
    const byTicker = new Map<string, Mover>();
    for (const s of tracked) {
      const symbol = (s.quote_symbol || s.ticker).toUpperCase();
      // Prefer the streamed last price; fall back to the stored snapshot.
      const price = quotes[symbol]?.price ?? data?.latest[s.id]?.price;
      if (price == null || !s.signal_price) continue;
      const pct = ((price - s.signal_price) / s.signal_price) * 100;
      if (!isFinite(pct)) continue;
      if (!byTicker.has(s.ticker))
        byTicker.set(s.ticker, { id: s.id, ticker: s.ticker, price, pct });
    }
    const all = [...byTicker.values()];
    return {
      gainers: all.filter((m) => m.pct > 0).sort((a, b) => b.pct - a.pct).slice(0, 5),
      decliners: all.filter((m) => m.pct < 0).sort((a, b) => a.pct - b.pct).slice(0, 5),
    };
  }, [tracked, quotes, data]);

  const empty = !isLoading && gainers.length === 0 && decliners.length === 0;

  return (
    <section className="rounded-xl border border-border/70 bg-card/60 p-4 mb-5">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 className="text-sm font-semibold tracking-tight">Market moves</h2>
        <span className="text-[11px] text-muted-foreground">
          Move since signal snapshot · open signals only ·{" "}
          {statusLabel(status, { streaming, marketOpen, updatedAt })}
        </span>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading price moves…</p>
      ) : empty ? (
        <p className="text-xs text-muted-foreground">
          No fresh moves right now —{" "}
          {marketOpen ? "awaiting the next price refresh" : "market closed"}. Open signals
          appear here once a current price is received.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <MoverList title="Increases" icon="up" movers={gainers} />
          <MoverList title="Drops" icon="down" movers={decliners} />
        </div>
      )}
      <p className="mt-3 text-[11px] text-muted-foreground/80">
        Observed movement only — historical context, not a prediction or advice.
      </p>
    </section>
  );
}


function MoverList({
  title,
  icon,
  movers,
}: {
  title: string;
  icon: "up" | "down";
  movers: Mover[];
}) {
  const Icon = icon === "up" ? TrendingUp : TrendingDown;
  return (
    <div>
      <div
        className={
          "flex items-center gap-1.5 text-xs font-medium mb-2 " +
          (icon === "up" ? "text-tailwind" : "text-headwind")
        }
      >
        <Icon className="w-3.5 h-3.5" />
        {title}
      </div>
      {movers.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">None right now.</p>
      ) : (
        <ul className="divide-y divide-border/50">
          {movers.map((m) => (
            <li key={m.ticker}>
              <Link
                to="/signal/$id"
                params={{ id: m.id }}
                className="flex items-center justify-between gap-3 py-1.5 hover:bg-accent/40 rounded-md px-1 transition-colors"
              >
                <span className="font-mono text-xs">{m.ticker}</span>
                <span className="flex items-center gap-3">
                  <span className="text-[11px] text-muted-foreground">
                    {fmtPrice(m.price)}
                  </span>
                  <span className={"text-xs font-medium " + pctTone(m.pct)}>
                    {fmtPct(m.pct)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
