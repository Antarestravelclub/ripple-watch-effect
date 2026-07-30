import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { EVENTS } from "@/lib/ripple-data";
import { TickerChip } from "./ticker-chip";

export interface TickerHit {
  ticker: string;
  sector: string;
  tone: "tailwind" | "headwind";
  eventCount: number;
}

function allTickers(): TickerHit[] {
  const map = new Map<string, TickerHit>();
  for (const ev of EVENTS) {
    const groups: Array<[typeof ev.tailwinds, "tailwind" | "headwind"]> = [
      [ev.tailwinds, "tailwind"],
      [ev.headwinds, "headwind"],
    ];
    for (const [gs, tone] of groups) {
      for (const g of gs) {
        for (const t of g.tickers) {
          const key = t.toUpperCase();
          const existing = map.get(key);
          if (existing) existing.eventCount += 1;
          else map.set(key, { ticker: key, sector: g.sector, tone, eventCount: 1 });
        }
      }
    }
  }
  return [...map.values()].sort((a, b) => a.ticker.localeCompare(b.ticker));
}

export function TickerSearch({
  query,
  onChange,
}: {
  query: string;
  onChange: (q: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  const universe = useMemo(allTickers, []);
  const q = query.trim().toUpperCase();

  const hits = useMemo(
    () =>
      q.length === 0
        ? []
        : universe
            .filter((h) => h.ticker.includes(q) || h.sector.toUpperCase().includes(q))
            .slice(0, 8),
    [q, universe],
  );

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-card/70 px-3 py-2 focus-within:border-primary/60 transition-colors">
        <Search className="w-4 h-4 text-muted-foreground shrink-0" />
        <input
          value={query}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="Search a ticker or sector — e.g. XOM, NVDA, Energy"
          aria-label="Search tickers"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
        />
        {query && (
          <button
            onClick={() => onChange("")}
            aria-label="Clear search"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {focused && hits.length > 0 && (
        <div className="absolute z-20 mt-2 w-full rounded-xl border border-border/70 bg-card/95 backdrop-blur p-2 shadow-xl">
          <div className="flex flex-wrap gap-2">
            {hits.map((h) => (
              <div key={h.ticker} className="flex items-center gap-1.5">
                <button
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onChange(h.ticker);
                  }}
                  className="text-xs font-mono px-2 py-1 rounded-md border border-border bg-background/40 hover:bg-background transition-colors"
                >
                  {h.ticker}
                </button>
                <span className="text-[11px] text-muted-foreground">
                  {h.sector} · {h.eventCount} event{h.eventCount > 1 ? "s" : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {q.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span>Tracking:</span>
          <TickerChip ticker={q} />
        </div>
      )}
    </div>
  );
}

export function eventTouchesTicker(
  ev: (typeof EVENTS)[number],
  query: string,
): boolean {
  const q = query.trim().toUpperCase();
  if (!q) return true;
  const groups = [...ev.tailwinds, ...ev.headwinds];
  return groups.some(
    (g) =>
      g.sector.toUpperCase().includes(q) ||
      g.tickers.some((t) => t.toUpperCase().includes(q)),
  );
}
