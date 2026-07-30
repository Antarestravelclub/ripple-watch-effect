import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getQuotes } from "@/lib/quotes.functions";
import { fmtPrice } from "@/lib/signal-metrics";

export function WatchlistQuotes({ tickers }: { tickers: string[] }) {
  const fetchQuotes = useServerFn(getQuotes);
  const { data, isLoading } = useQuery({
    queryKey: ["quotes", [...tickers].sort().join(",")],
    queryFn: () => fetchQuotes({ data: { tickers } }),
    enabled: tickers.length > 0,
    staleTime: 60_000,
  });

  if (tickers.length === 0) return null;

  return (
    <section className="rounded-xl border border-border/70 bg-card/60 p-4 mb-6">
      <h2 className="text-sm font-semibold tracking-tight mb-3">Live quotes</h2>
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Fetching quotes…</p>
      ) : (
        <ul className="divide-y divide-border/50">
          {tickers.map((t) => {
            const q = data?.quotes?.[t];
            return (
              <li key={t} className="flex items-center justify-between gap-3 py-1.5">
                <span className="font-mono text-xs">{t}</span>
                {q ? (
                  <span className="flex items-center gap-3 tabular-nums">
                    <span className="text-[11px] text-muted-foreground">
                      {fmtPrice(q.price)}
                    </span>
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
                  <span className="text-[11px] text-muted-foreground">No live quote</span>
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
