import { addTicker, removeTicker, useWatchlist } from "@/lib/watchlist-store";
import { Plus, Check } from "lucide-react";
import { TickerLink } from "./ticker-link";

/**
 * Symbol chip: the symbol text opens the symbol's data page, the small
 * +/✓ button adds or removes it from the watchlist.
 */
export function TickerChip({
  ticker,
  tone = "neutral",
}: {
  ticker: string;
  tone?: "tailwind" | "headwind" | "neutral";
}) {
  const watchlist = useWatchlist();
  const inList = watchlist.includes(ticker.toUpperCase());

  const toneClass =
    tone === "tailwind"
      ? "border-tailwind/40 text-tailwind"
      : tone === "headwind"
        ? "border-headwind/40 text-headwind"
        : "border-border text-foreground";

  return (
    <span
      className={
        "group inline-flex items-center gap-1 text-xs font-mono font-medium pl-2 pr-1 py-1 rounded-md border bg-background/40 " +
        toneClass
      }
    >
      <TickerLink symbol={ticker} className="font-mono" />
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          inList ? removeTicker(ticker) : addTicker(ticker);
        }}
        className="rounded p-0.5 hover:bg-background transition-colors"
        title={inList ? "Remove from watchlist" : "Add to watchlist"}
        aria-label={inList ? `Remove ${ticker} from watchlist` : `Add ${ticker} to watchlist`}
      >
        {inList ? (
          <Check className="w-3 h-3 opacity-70" />
        ) : (
          <Plus className="w-3 h-3 opacity-40 group-hover:opacity-80 transition-opacity" />
        )}
      </button>
    </span>
  );
}
