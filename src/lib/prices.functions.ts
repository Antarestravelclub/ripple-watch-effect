import { createServerFn } from "@tanstack/react-start";

export interface StoredPrice {
  symbol: string;
  price: number;
  dayHigh: number | null;
  dayLow: number | null;
  prevClose: number | null;
  quoteTime: string | null;
  fetchTime: string;
  source: string;
}

export interface PriceFeedRun {
  finishedAt: string;
  source: string;
  symbolsRequested: number;
  requestsMade: number;
  rateLimited: number;
  succeeded: number;
  failed: number;
  ok: boolean;
  error: string | null;
}

/**
 * The shared price store. Every consumer (Market Moves, the invalidation
 * engine, stop/target checks) reads these rows — nobody calls the provider.
 */
export const getLatestPrices = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [pricesRes, runsRes] = await Promise.all([
    supabaseAdmin
      .from("latest_prices")
      .select("symbol,price,day_high,day_low,prev_close,quote_time,fetch_time,source"),
    supabaseAdmin
      .from("price_fetch_runs")
      .select(
        "finished_at,source,symbols_requested,requests_made,rate_limited,succeeded,failed,ok,error",
      )
      .order("finished_at", { ascending: false })
      .limit(10),
  ]);

  const prices: Record<string, StoredPrice> = {};
  for (const r of pricesRes.data ?? []) {
    prices[r.symbol] = {
      symbol: r.symbol,
      price: Number(r.price),
      dayHigh: r.day_high != null ? Number(r.day_high) : null,
      dayLow: r.day_low != null ? Number(r.day_low) : null,
      prevClose: r.prev_close != null ? Number(r.prev_close) : null,
      quoteTime: r.quote_time,
      fetchTime: r.fetch_time,
      source: r.source,
    };
  }

  const runs: PriceFeedRun[] = (runsRes.data ?? []).map((r) => ({
    finishedAt: r.finished_at,
    source: r.source,
    symbolsRequested: r.symbols_requested,
    requestsMade: r.requests_made,
    rateLimited: r.rate_limited,
    succeeded: r.succeeded,
    failed: r.failed,
    ok: r.ok,
    error: r.error,
  }));

  const successRate = (() => {
    const attempted = runs.reduce((n, r) => n + r.symbolsRequested, 0);
    const got = runs.reduce((n, r) => n + r.succeeded, 0);
    return attempted > 0 ? Math.round((got / attempted) * 100) : null;
  })();

  return {
    prices,
    lastRun: runs[0] ?? null,
    runs,
    successRate,
    at: new Date().toISOString(),
  };
});
