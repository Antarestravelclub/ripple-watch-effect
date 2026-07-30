import { tickerMeta, LISTING_LABEL } from "@/lib/ticker-registry";

/** Amber pill used when a price could not be fetched (distinct from a real 0.0%). */
export function NoDataBadge({ reason }: { reason?: string | null }) {
  return (
    <span
      title={reason ?? "No price returned by the market feed"}
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider border border-headwind/40 bg-headwind/10 text-headwind"
    >
      no data
    </span>
  );
}

/**
 * Ticker with exchange suffix for non-US primary listings, a listing label,
 * and an "accessible alternative" chip when a US ADR/ETF exists.
 */
export function TickerLabel({
  ticker,
  className = "",
  showAlt = true,
}: {
  ticker: string;
  className?: string;
  showAlt?: boolean;
}) {
  const m = tickerMeta(ticker);
  return (
    <span className={"inline-flex items-center gap-1 " + className}>
      <span className="font-semibold tracking-wide">{m.display}</span>
      {m.listing !== "US" && (
        <span
          title={m.name ?? undefined}
          className="rounded px-1 py-0.5 text-[9px] uppercase tracking-wider border border-border/70 bg-background/60 text-muted-foreground"
        >
          {LISTING_LABEL[m.listing]}
        </span>
      )}
      {showAlt && m.alt && (
        <span
          title={`Accessible alternative: ${m.alt.ticker} (${m.alt.label})`}
          className="rounded px-1 py-0.5 text-[9px] uppercase tracking-wider border border-primary/30 bg-primary/10 text-primary"
        >
          {m.alt.ticker} · {m.alt.label}
        </span>
      )}
    </span>
  );
}
