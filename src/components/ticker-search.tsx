import { useEffect, useMemo, useState } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { EVENTS } from "@/lib/ripple-data";
import { searchTickers } from "@/lib/quotes.functions";

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

function useDebounced(value: string, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function TickerSearch({
  query,
  onChange,
  onSelectSymbol,
}: {
  query: string;
  onChange: (q: string) => void;
  onSelectSymbol?: (symbol: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  const universe = useMemo(allTickers, []);
  const q = query.trim().toUpperCase();
  const debounced = useDebounced(q, 300);

  const lookup = useServerFn(searchTickers);
  const { data, isFetching } = useQuery({
    queryKey: ["symbol-search", debounced],
    queryFn: () => lookup({ data: { q: debounced } }),
    enabled: debounced.length >= 1,
    staleTime: 5 * 60_000,
  });

  const local = useMemo(
    () =>
      q.length === 0
        ? []
        : universe
            .filter((h) => h.ticker.includes(q) || h.sector.toUpperCase().includes(q))
            .slice(0, 6),
    [q, universe],
  );

  const market = data?.matches ?? [];
  const select = (symbol: string) => {
    onChange(symbol);
    onSelectSymbol?.(symbol);
    setFocused(false);
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-card/70 px-3 py-2 focus-within:border-primary/60 transition-colors">
        <Search className="w-4 h-4 text-muted-foreground shrink-0" />
        <input
          value={query}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 180)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && q) select(q);
          }}
          placeholder="Look up a stock symbol or company — e.g. NVDA, Exxon, Energy"
          aria-label="Search stock symbols"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
        />
        {isFetching && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
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

      {focused && (market.length > 0 || local.length > 0) && (
        <div className="absolute z-20 mt-2 w-full rounded-xl border border-border/70 bg-card/95 backdrop-blur p-2 shadow-xl max-h-80 overflow-auto">
          {market.length > 0 && (
            <>
              <p className="px-1 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                Market symbols
              </p>
              <ul className="mb-2">
                {market.map((m) => (
                  <li key={m.symbol}>
                    <button
                      onMouseDown={(e) => {
                        e.preventDefault();
                        select(m.symbol);
                      }}
                      className="w-full flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left hover:bg-accent/50"
                    >
                      <span className="font-mono text-xs">
                        {m.symbol}
                        {m.exchange && m.exchange !== "US" && (
                          <span className="ml-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                            {m.exchange}
                          </span>
                        )}
                      </span>
                      <span className="text-[11px] text-muted-foreground truncate max-w-[60%]">
                        {m.description}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          {local.length > 0 && (
            <>
              <p className="px-1 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                In Ripple events
              </p>
              <div className="flex flex-wrap gap-2 px-1 pb-1">
                {local.map((h) => (
                  <button
                    key={h.ticker}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      select(h.ticker);
                    }}
                    className="text-xs font-mono px-2 py-1 rounded-md border border-border bg-background/40 hover:bg-background transition-colors"
                  >
                    {h.ticker}
                    <span className="ml-1.5 text-[10px] text-muted-foreground">
                      {h.sector} · {h.eventCount}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
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
