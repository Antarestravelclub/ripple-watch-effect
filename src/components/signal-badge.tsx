import { useNavigate } from "@tanstack/react-router";
import type { SignalRow } from "@/lib/signal-metrics";
import { fmtPct, pctTone } from "@/lib/signal-metrics";
import { NoDataBadge, TickerLabel } from "./ticker-meta-chips";

export function SignalBadge({
  signal,
  currentPrice,
}: {
  signal: SignalRow;
  currentPrice: number | null;
}) {
  const navigate = useNavigate();
  const sp = signal.signal_price;
  // Move since snapshot = (current delayed price - snapshot price) / snapshot price.
  let pct: number | null = null;
  if (sp && currentPrice != null) {
    const raw = ((currentPrice - sp) / sp) * 100;
    pct = signal.direction === "long" ? raw : -raw;
  }
  const missing = pct === null;
  const reason =
    signal.price_error ??
    (sp == null
      ? "No snapshot price captured for this signal yet"
      : "No current price returned by the market feed");
  const dirLabel = signal.direction === "long" ? "LONG" : "SHORT";
  const dirTone =
    signal.direction === "long"
      ? "bg-tailwind/15 text-tailwind border-tailwind/30"
      : "bg-headwind/15 text-headwind border-headwind/30";
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        navigate({ to: "/signal/$id", params: { id: signal.id } });
      }}
      className="inline-flex items-center gap-1.5 text-[11px] font-mono px-2 py-0.5 rounded-md border border-border/60 bg-background/50 hover:bg-background transition-colors"
      title={missing ? reason : "View tracked signal"}
    >
      <span className={"px-1 rounded border " + dirTone}>{dirLabel}</span>
      <TickerLabel ticker={signal.ticker} showAlt={false} />
      {missing ? (
        <NoDataBadge reason={reason} />
      ) : (
        <span className={pctTone(pct) + " tabular-nums"}>{fmtPct(pct, 1)}</span>
      )}
      {signal.status === "closed" && (
        <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
          · {signal.close_reason ?? "closed"}
        </span>
      )}
    </button>
  );
}
