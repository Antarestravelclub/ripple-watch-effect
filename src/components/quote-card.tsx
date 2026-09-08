import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { getQuote } from "@/lib/quotes.functions";
import { useLiveQuotes, statusLabel } from "@/hooks/use-live-quotes";
import { LivePrice } from "./live-price";
import { TickerChip } from "./ticker-chip";
import { TickerLink } from "./ticker-link";

function tone(v: number) {
  return v > 0 ? "text-tailwind" : v < 0 ? "text-headwind" : "text-muted-foreground";
}

function money(v: number, currency: string | null) {
  if (!isFinite(v)) return "n/a";
  return !currency || currency === "USD"
    ? `$${v.toFixed(2)}`
    : `${v.toFixed(2)} ${currency}`;
}

const MISSING: Record<string, string> = {
  no_key: "Price feed is not configured yet.",
  rate_limited: "The market feed is rate limited right now — retrying shortly.",
  network_error: "Couldn't reach the market feed — retrying shortly.",
  unsupported_symbol: "No live quote for this symbol on the current data plan.",
};

export function QuoteCard({ ticker }: { ticker: string }) {
  const fetchQuote = useServerFn(getQuote);
  const symbol = ticker.trim().toUpperCase();
  const tickers = useMemo(() => (symbol ? [symbol] : []), [symbol]);

  const { data, isLoading } = useQuery({
    queryKey: ["quote", symbol],
    queryFn: () => fetchQuote({ data: { ticker: symbol } }),
    enabled: symbol.length > 0,
    staleTime: 60_000,
  });

  const liveState = useLiveQuotes(tickers);
  const live = liveState.quotes[symbol] ?? null;

  if (!symbol) return null;

  const status = data?.status ?? liveState.status;
  const currency = live?.currency ?? data?.quote?.currency ?? null;
  const price = live?.price ?? data?.quote?.price ?? null;
  const change = live?.change ?? data?.quote?.change ?? null;
  const changePct = live?.changePct ?? data?.quote?.changePct ?? null;
  const snap = data?.quote ?? null;

  return (
    <section className="rounded-xl border border-border/70 bg-card/60 p-4 mb-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-mono text-lg font-semibold tracking-tight">
              <TickerLink symbol={symbol} />
            </h2>
            <TickerChip ticker={symbol} />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {data?.profile?.name ?? (isLoading ? "Loading…" : "Company details unavailable")}
            {data?.profile?.industry ? ` · ${data.profile.industry}` : ""}
            {data?.profile?.exchange ? ` · ${data.profile.exchange}` : ""}
          </p>
        </div>
        {price !== null && (
          <div className="text-right shrink-0">
            <div className="text-xl font-semibold">
              <LivePrice price={price} currency={currency} />
            </div>
            <div className={"text-xs font-medium tabular-nums " + tone(changePct ?? 0)}>
              {(change ?? 0) >= 0 ? "+" : ""}
              {(change ?? 0).toFixed(2)} ({(changePct ?? 0) >= 0 ? "+" : ""}
              {(changePct ?? 0).toFixed(2)}%)
            </div>
          </div>
        )}
      </div>

      {isLoading && price === null ? (
        <p className="text-xs text-muted-foreground mt-3">Fetching quote…</p>
      ) : price === null ? (
        <p className="text-xs text-muted-foreground mt-3">
          {MISSING[status] ?? MISSING.unsupported_symbol}
        </p>
      ) : (
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-xs">
          <Stat label="Open" value={money(snap?.open ?? NaN, currency)} />
          <Stat label="Day high" value={money(snap?.high ?? NaN, currency)} />
          <Stat label="Day low" value={money(snap?.low ?? NaN, currency)} />
          <Stat
            label="Prev close"
            value={money(live?.prevClose ?? snap?.prevClose ?? NaN, currency)}
          />
        </dl>
      )}

      <p className="mt-3 text-[11px] text-muted-foreground/80">
        {statusLabel(liveState.status, {
          streaming: liveState.streaming,
          marketOpen: liveState.marketOpen,
          updatedAt: liveState.updatedAt,
        })}{" "}
        — shown for research context only, not advice.
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
