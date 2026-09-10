import { eventTopPicks } from "@/lib/ripple-regions";
import { useLiveQuotes, statusLabel } from "@/hooks/use-live-quotes";
import { LivePrice } from "./live-price";
import { tickerMeta } from "@/lib/ticker-registry";
import { NoDataBadge, TickerLabel } from "./ticker-meta-chips";
import { TickerLink } from "./ticker-link";

function tone(pct: number | null) {
  if (pct === null) return "text-muted-foreground";
  if (pct > 0) return "text-tailwind";
  if (pct < 0) return "text-headwind";
  return "text-muted-foreground";
}

/**
 * Live price strip for the tickers an event mechanically touches.
 * Non-tradable names are never displayed; unpriceable ones get a "no data" pill.
 */
export function LivePicks({
  eventId,
  compact = false,
}: {
  eventId: string;
  compact?: boolean;
}) {
  // One row per ticker: an event can list the same name more than once.
  const picks = [
    ...new Map(
      eventTopPicks(eventId)
        .filter((p) => tickerMeta(p.ticker).tradable)
        .map((p) => [p.ticker, p] as const),
    ).values(),
  ];
  const symbols = picks.map((p) => tickerMeta(p.ticker).quote);
  const { quotes, isLoading, status, streaming, marketOpen, updatedAt } =
    useLiveQuotes(symbols);

  if (picks.length === 0) return null;

  const rows = picks.map((p) => {
    const meta = tickerMeta(p.ticker);
    const q = quotes[meta.quote] ?? null;
    return {
      ...p,
      meta,
      price: q?.price ?? null,
      pct: q?.changePct ?? null,
      currency: q?.currency ?? null,
    };
  });

  if (compact) {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {rows.map((r) => (
          <span
            key={r.ticker}
            className={
              "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] " +
              (r.side === "long"
                ? "border-tailwind/30 bg-tailwind/10"
                : "border-headwind/30 bg-headwind/10")
            }
            title={r.thesis}
          >
            <TickerLink symbol={r.ticker}>
              <TickerLabel ticker={r.ticker} showAlt={false} />
            </TickerLink>
            {r.price !== null ? (
              <>
                <LivePrice
                  price={r.price}
                  currency={r.currency}
                  className="text-muted-foreground"
                />
                <span className={tone(r.pct)}>
                  {r.pct !== null
                    ? `${r.pct > 0 ? "+" : ""}${r.pct.toFixed(2)}%`
                    : "—"}
                </span>
              </>
            ) : isLoading ? (
              <span className="text-muted-foreground">…</span>
            ) : (
              <NoDataBadge
                reason={`No quote for ${r.meta.quote} from the market feed`}
              />
            )}
          </span>
        ))}
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-border/70 bg-card/60 p-4">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 className="text-sm font-semibold tracking-tight">
          Live prices for exposed tickers
        </h2>
        <span className="text-[11px] text-muted-foreground">
          {statusLabel(status, { streaming, marketOpen, updatedAt })}
        </span>
      </div>
      <div className="grid gap-2">
        {rows.map((r) => (
          <div
            key={r.ticker}
            className="flex items-start gap-3 rounded-lg border border-border/60 bg-background/40 px-3 py-2"
          >
            <div className="min-w-[64px]">
              <TickerLink symbol={r.ticker}>
                <TickerLabel ticker={r.ticker} className="text-sm flex-wrap" />
              </TickerLink>
              <div
                className={
                  "text-[10px] uppercase tracking-wider " +
                  (r.side === "long" ? "text-tailwind" : "text-headwind")
                }
              >
                {r.side === "long" ? "Tailwind" : "Headwind"}
              </div>
            </div>
            <p className="flex-1 text-xs text-muted-foreground">{r.thesis}</p>
            <div className="text-right">
              <div className="text-sm">
                {r.price !== null ? (
                  <LivePrice price={r.price} currency={r.currency} />
                ) : isLoading ? (
                  "…"
                ) : (
                  <NoDataBadge
                    reason={`No quote for ${r.meta.quote} from the market feed`}
                  />
                )}
              </div>
              <div className={"text-xs tabular-nums " + tone(r.pct)}>
                {r.pct !== null
                  ? `${r.pct > 0 ? "+" : ""}${r.pct.toFixed(2)}% today`
                  : ""}
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground/80">
        Delayed quotes. Exposure mapping — observation and context, not advice.
      </p>
    </section>
  );
}
