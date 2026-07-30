import { useLiveQuotes, statusLabel } from "@/hooks/use-live-quotes";
import { LivePrice } from "./live-price";

export function WatchlistQuotes({ tickers }: { tickers: string[] }) {
  const { quotes, isLoading, status, streaming, marketOpen, updatedAt } =
    useLiveQuotes(tickers);

  if (tickers.length === 0) return null;

  return (
    <section className="rounded-xl border border-border/70 bg-card/60 p-4 mb-6">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 className="text-sm font-semibold tracking-tight">Live quotes</h2>
        <span className="text-[11px] text-muted-foreground">
          {statusLabel(status, { streaming, marketOpen, updatedAt })}
        </span>
      </div>
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Fetching quotes…</p>
      ) : (
        <ul className="divide-y divide-border/50">
          {tickers.map((t) => {
            const q = quotes[t.toUpperCase()];
            return (
              <li key={t} className="flex items-center justify-between gap-3 py-1.5">
                <span className="font-mono text-xs">{t}</span>
                {q ? (
                  <span className="flex items-center gap-3 tabular-nums">
                    <LivePrice
                      price={q.price}
                      currency={q.currency}
                      className="text-[11px] text-muted-foreground"
                    />
                    <span
                      className={
                        "text-xs font-medium " +
                        (q.changePct > 0
                          ? "text-tailwind"
                          : q.changePct < 0
                            ? "text-headwind"
                            : "text-muted-foreground")
                      }
                    >
                      {q.changePct >= 0 ? "+" : ""}
                      {q.changePct.toFixed(2)}%
                    </span>
                  </span>
                ) : (
                  <span className="text-[11px] text-muted-foreground">
                    {status === "no_key"
                      ? "Feed not configured"
                      : status === "rate_limited"
                        ? "Rate limited"
                        : "No live quote"}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-muted-foreground/80">
        Delayed prices — research context only, not advice.
      </p>
    </section>
  );
}
