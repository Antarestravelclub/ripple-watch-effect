// ATR(14) from daily bars, used to scale stops and targets at signal creation.
import { dailyBars } from "./daily-bars.server";

export const ATR_PERIOD = 14;

/** True-range average over the last ATR_PERIOD sessions. Null when history is too short. */
export function atrFromBars(
  bars: Array<{ high: number; low: number; close: number }>,
): number | null {
  if (bars.length < ATR_PERIOD + 1) return null;
  const trs: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const b = bars[i]!;
    const prevClose = bars[i - 1]!.close;
    trs.push(
      Math.max(
        b.high - b.low,
        Math.abs(b.high - prevClose),
        Math.abs(b.low - prevClose),
      ),
    );
  }
  const window = trs.slice(-ATR_PERIOD);
  const atr = window.reduce((a, b) => a + b, 0) / window.length;
  return atr > 0 ? +atr.toFixed(4) : null;
}

const memo = new Map<string, number | null>();

/** ATR(14) for a quote symbol. Null means "insufficient history" — reject the signal. */
export async function atrFor(symbol: string): Promise<number | null> {
  if (!symbol) return null;
  if (memo.has(symbol)) return memo.get(symbol)!;
  const bars = await dailyBars(symbol, "6mo");
  const atr = atrFromBars(bars);
  memo.set(symbol, atr);
  return atr;
}
