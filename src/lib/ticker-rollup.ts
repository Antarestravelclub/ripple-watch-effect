// Ticker-level rollup of active signals.
// Pure + client-safe: no secrets, no server imports.

import type { SignalRow } from "./signal-metrics";

export type Stance = "long" | "short" | "conflicted";

export interface TickerRollup {
  ticker: string;
  quoteSymbol: string;
  longs: SignalRow[];
  shorts: SignalRow[];
  activeLong: number;
  activeShort: number;
  stance: Stance;
  /** Earliest snapshot price across active signals (and when it was taken). */
  earliestPrice: number | null;
  earliestAt: string | null;
  /** All active signals for this ticker (open status). */
  signals: SignalRow[];
}

export function isActive(s: SignalRow): boolean {
  return s.status === "open" && !s.needs_review;
}

/** One row per ticker with at least one active signal. */
export function rollupTickers(signals: SignalRow[]): TickerRollup[] {
  const byTicker = new Map<string, SignalRow[]>();
  for (const s of signals) {
    if (!isActive(s)) continue;
    const arr = byTicker.get(s.ticker) ?? [];
    arr.push(s);
    byTicker.set(s.ticker, arr);
  }

  const rows: TickerRollup[] = [];
  for (const [ticker, list] of byTicker) {
    const longs = list.filter((s) => s.direction === "long");
    const shorts = list.filter((s) => s.direction === "short");
    const stance: Stance =
      longs.length > 0 && shorts.length > 0
        ? "conflicted"
        : shorts.length > 0
          ? "short"
          : "long";
    const priced = list
      .filter((s) => s.signal_price != null)
      .sort(
        (a, b) =>
          new Date(a.signal_timestamp).getTime() -
          new Date(b.signal_timestamp).getTime(),
      );
    rows.push({
      ticker,
      quoteSymbol: list[0].quote_symbol || ticker,
      longs,
      shorts,
      activeLong: longs.length,
      activeShort: shorts.length,
      stance,
      earliestPrice: priced[0]?.signal_price ?? null,
      earliestAt: priced[0]?.signal_timestamp ?? null,
      signals: list,
    });
  }
  return rows.sort((a, b) => a.ticker.localeCompare(b.ticker));
}

/** Raw price move since the earliest active snapshot, in percent. */
export function combinedMovePct(
  row: TickerRollup,
  currentPrice: number | null,
): number | null {
  if (!row.earliestPrice || currentPrice == null) return null;
  return ((currentPrice - row.earliestPrice) / row.earliestPrice) * 100;
}

/**
 * The same price move attributed once, in the direction of the ticker's net
 * stance. Conflicted tickers have no single stance, so they return null.
 */
export function stanceAttributedPct(
  stance: Stance,
  rawPct: number | null,
): number | null {
  if (rawPct == null || stance === "conflicted") return null;
  return stance === "short" ? -rawPct : rawPct;
}

export const STANCE_LABEL: Record<Stance, string> = {
  long: "LONG",
  short: "SHORT",
  conflicted: "CONFLICTED",
};

export const STANCE_CLASS: Record<Stance, string> = {
  long: "bg-tailwind/15 text-tailwind border-tailwind/30",
  short: "bg-headwind/15 text-headwind border-headwind/30",
  conflicted: "bg-muted/40 text-muted-foreground border-border/70",
};

export const CONFLICT_NOTE = "Opposing active signals — net exposure unclear.";
