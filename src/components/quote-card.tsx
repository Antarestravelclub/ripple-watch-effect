import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getQuote } from "@/lib/quotes.functions";
import { fmtPrice } from "@/lib/signal-metrics";
import { TickerChip } from "./ticker-chip";

function tone(v: number) {
  return v > 0 ? "text-tailwind" : v < 0 ? "text-headwind" : "text-muted-foreground";
}

export function QuoteCard({ ticker }: { ticker: string }) {
  const fetchQuote = useServerFn(getQuote);
  const symbol = ticker.trim().toUpperCase();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["quote", symbol],
    queryFn: () => fetchQuote({ data: { ticker: symbol } }),
    enabled: symbol.length > 0,
    staleTime: 60_000,
  });

  if (!symbol) return null;

  return (
    <section className="rounded-xl border border-border/70 bg-card/60 p-4 mb-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-mono text-lg font-semibold tracking-tight">{symbol}</h2>
            <TickerChip ticker={symbol} />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {data?.profile?.name ?? (isLoading ? "Loading…" : "Company details unavailable")}
            {data?.profile?.industry ? ` · ${data.profile.industry}` : ""}
            {data?.profile?.exchange ? ` · ${data.profile.exchange}` : ""}
          </p>
        </div>
        {data?.quote && (
          <div className="text-right shrink-0">
            <div className="text-xl font-semibold tabular-nums">
              {fmtPrice(data.quote.price)}
            </div>
            <div className={"text-xs font-medium tabular-nums " + tone(data.quote.changePct)}>
              {data.quote.change >= 0 ? "+" : ""}
              {data.quote.change.toFixed(2)} ({data.quote.changePct >= 0 ? "+" : ""}
              {data.quote.changePct.toFixed(2)}%)
            </div>
          </div>
        )}
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground mt-3">Fetching quote…</p>
      ) : isError || !data?.quote ? (
        <p className="text-xs text-muted-foreground mt-3">
          No live quote for this symbol (US-listed symbols only).
        </p>
      ) : (
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-xs">
          <Stat label="Open" value={fmtPrice(data.quote.open)} />
          <Stat label="Day high" value={fmtPrice(data.quote.high)} />
          <Stat label="Day low" value={fmtPrice(data.quote.low)} />
          <Stat label="Prev close" value={fmtPrice(data.quote.prevClose)} />
        </dl>
      )}

      <p className="mt-3 text-[11px] text-muted-foreground/80">
        Delayed market data — shown for research context only, not advice.
      </p>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/50 bg-background/40 px-2.5 py-2">
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="tabular-nums text-foreground mt-0.5">{value}</dd>
    </div>
  );
}
