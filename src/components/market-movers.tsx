import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { TrendingUp, TrendingDown } from "lucide-react";
import { listSignals } from "@/lib/signals.functions";
import { fmtPct, fmtPrice, pctTone } from "@/lib/signal-metrics";

interface Mover {
  id: string;
  ticker: string;
  price: number;
  pct: number;
}

export function MarketMovers() {
  const list = useServerFn(listSignals);
  const { data, isLoading } = useQuery({
    queryKey: ["signals", "all"],
    queryFn: () => list(),
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });


  const { gainers, decliners, asOf } = useMemo(() => {
    const byTicker = new Map<string, Mover>();
    let asOf: string | null = null;
    for (const s of data?.signals ?? []) {
      const snap = data?.latest[s.id];
      if (!snap || !s.signal_price) continue;
      const pct = ((snap.price - s.signal_price) / s.signal_price) * 100;
      if (!isFinite(pct)) continue;
      if (!byTicker.has(s.ticker))
        byTicker.set(s.ticker, { id: s.id, ticker: s.ticker, price: snap.price, pct });
      if (!asOf || snap.captured_at > asOf) asOf = snap.captured_at;
    }
    const all = [...byTicker.values()];
    return {
      gainers: all.filter((m) => m.pct > 0).sort((a, b) => b.pct - a.pct).slice(0, 5),
      decliners: all.filter((m) => m.pct < 0).sort((a, b) => a.pct - b.pct).slice(0, 5),
      asOf,
    };
  }, [data]);

  const empty = !isLoading && gainers.length === 0 && decliners.length === 0;

  return (
    <section className="rounded-xl border border-border/70 bg-card/60 p-4 mb-5">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 className="text-sm font-semibold tracking-tight">Market moves</h2>
        <span className="text-[11px] text-muted-foreground">
          Delayed prices · move since signal snapshot
          {asOf ? ` · as of ${new Date(asOf).toLocaleString()}` : ""}
        </span>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading price moves…</p>
      ) : empty ? (
        <p className="text-xs text-muted-foreground">
          No price snapshots yet. Seed signals from the Tracker page to start monitoring
          moves.
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
