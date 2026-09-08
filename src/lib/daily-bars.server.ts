// Server-only daily OHLC history.
// The primary quote feed's daily-candle endpoint is not available on the
// current plan, so history comes from the public chart API. Used for ATR(14)
// at signal creation and for benchmark (index) closes.

export interface DailyBar {
  /** UTC midnight-ish timestamp of the session, in ms. */
  time: number;
  high: number;
  low: number;
  close: number;
}

const CHART = "https://query1.finance.yahoo.com/v8/finance/chart";

const cache = new Map<string, { at: number; bars: DailyBar[] }>();
const TTL_MS = 30 * 60_000;

/** Daily bars for a symbol, newest last. Empty array when unavailable. */
export async function dailyBars(symbol: string, range = "6mo"): Promise<DailyBar[]> {
  if (!symbol) return [];
  const key = `${symbol}|${range}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.bars;
  try {
    const res = await fetch(
      `${CHART}/${encodeURIComponent(symbol)}?range=${range}&interval=1d`,
      { headers: { "User-Agent": "Mozilla/5.0 (compatible; RippleEffect/1.0)" } },
    );
    if (!res.ok) return [];
    const j = (await res.json()) as {
      chart?: {
        result?: Array<{
          timestamp?: number[];
          indicators?: {
            quote?: Array<{ high?: (number | null)[]; low?: (number | null)[]; close?: (number | null)[] }>;
          };
        }>;
      };
    };
    const r = j.chart?.result?.[0];
    const q = r?.indicators?.quote?.[0];
    const ts = r?.timestamp ?? [];
    if (!q || ts.length === 0) return [];
    const bars: DailyBar[] = [];
    for (let i = 0; i < ts.length; i++) {
      const h = q.high?.[i];
      const l = q.low?.[i];
      const c = q.close?.[i];
      if (typeof h !== "number" || typeof l !== "number" || typeof c !== "number") continue;
      bars.push({ time: ts[i]! * 1000, high: h, low: l, close: c });
    }
    cache.set(key, { at: Date.now(), bars });
    return bars;
  } catch {
    return [];
  }
}

/** Closing price on (or immediately before) an instant. Null when unknown. */
export async function closeOnOrBefore(
  symbol: string,
  atISO: string,
  range = "2y",
): Promise<number | null> {
  const bars = await dailyBars(symbol, range);
  if (bars.length === 0) return null;
  const t = new Date(atISO).getTime();
  let pick: DailyBar | null = null;
  for (const b of bars) {
    if (b.time <= t) pick = b;
    else break;
  }
  return (pick ?? bars[0]!).close;
}
