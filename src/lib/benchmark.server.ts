// Benchmark (index) prices used to compute per-signal alpha.
import { dailyBars, closeOnOrBefore } from "./daily-bars.server";

export const BENCHMARK_SYMBOL = "SPY";

/** Latest available index price. Null when the history feed is unreachable. */
export async function benchmarkPrice(symbol = BENCHMARK_SYMBOL): Promise<number | null> {
  const bars = await dailyBars(symbol, "1mo");
  const last = bars[bars.length - 1];
  return last ? last.close : null;
}

/** Index close on (or just before) an instant — used for entry/exit backfill. */
export async function benchmarkCloseAt(
  atISO: string,
  symbol = BENCHMARK_SYMBOL,
): Promise<number | null> {
  return closeOnOrBefore(symbol, atISO, "2y");
}
