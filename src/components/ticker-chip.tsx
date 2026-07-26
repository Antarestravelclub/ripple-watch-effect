import { addTicker, removeTicker, useWatchlist } from "@/lib/watchlist-store";
import { Plus, Check } from "lucide-react";

export function TickerChip({ ticker, tone = "neutral" }: { ticker: string; tone?: "tailwind" | "headwind" | "neutral" }) {
  const watchlist = useWatchlist();
  const inList = watchlist.includes(ticker.toUpperCase());

  const toneClass =
    tone === "tailwind"
      ? "border-tailwind/40 text-tailwind"
      : tone === "headwind"
      ? "border-headwind/40 text-headwind"
      : "border-border text-foreground";

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        inList ? removeTicker(ticker) : addTicker(ticker);
      }}
      className={
        "group inline-flex items-center gap-1 text-xs font-mono font-medium px-2 py-1 rounded-md border bg-background/40 hover:bg-background transition-colors " +
        toneClass
      }
      title={inList ? "Remove from watchlist" : "Add to watchlist"}
    >
      {ticker}
      {inList ? (
        <Check className="w-3 h-3 opacity-70" />
      ) : (
        <Plus className="w-3 h-3 opacity-0 group-hover:opacity-70 transition-opacity" />
      )}
    </button>
  );
}
