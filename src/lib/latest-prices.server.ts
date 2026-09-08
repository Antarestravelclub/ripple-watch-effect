// Server-only batched price fetcher — the single writer of public.latest_prices.
//
// One fetch, many consumers: the evaluation cron calls refreshLatestPrices()
// once per run with the deduplicated set of symbols (open signals + benchmark),
// and every other part of the app reads the latest_prices table instead of
// calling the market-data provider itself.
//
// Provider note: the previous quote provider serves ONE symbol per request and
// has no batch endpoint, which is what produced the 429s. This uses the public
// Yahoo Finance multi-symbol "spark" endpoint, which accepts many symbols in a
// single request.

export const PRICE_SOURCE = "yahoo-spark";

/** Provider limit we respect per request. */
const MAX_SYMBOLS_PER_REQUEST = 50;
const ENDPOINT = "https://query1.finance.yahoo.com/v7/finance/spark";

export interface BatchQuote {
  symbol: string;
  price: number;
  dayHigh: number | null;
  dayLow: number | null;
  prevClose: number | null;
  quoteTime: string | null;
}

export interface PriceRunStats {
  source: string;
  symbolsRequested: number;
  requestsMade: number;
  rateLimited: number;
  succeeded: number;
  failed: number;
  ok: boolean;
  error: string | null;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

interface SparkMeta {
  symbol?: string;
  regularMarketPrice?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  chartPreviousClose?: number;
  regularMarketTime?: number;
}

/**
 * Fetches one chunk. Honours Retry-After on 429 with exponential backoff and
 * gives up on the chunk (leaving it for the next cron run) rather than
 * hammering the provider.
 */
async function fetchChunk(
  symbols: string[],
  stats: PriceRunStats,
): Promise<BatchQuote[]> {
  const url = `${ENDPOINT}?symbols=${encodeURIComponent(symbols.join(","))}&range=1d&interval=1d`;
  const MAX_ATTEMPTS = 3;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    stats.requestsMade += 1;
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      });
      if (res.status === 429) {
        stats.rateLimited += 1;
        const retryAfter = Number(res.headers.get("retry-after"));
        const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, 20_000)
          : Math.min(1000 * 2 ** attempt, 20_000);
        if (attempt === MAX_ATTEMPTS) {
          stats.failed += symbols.length;
          stats.error = `Rate limited (HTTP 429) after ${attempt} attempts — skipped ${symbols.length} symbols until next run`;
          return [];
        }
        await sleep(waitMs);
        continue;
      }
      if (!res.ok) {
        // A single unknown symbol makes the provider reject the whole batch.
        // Bisect so one bad ticker can't cost us the other 49 prices.
        if (symbols.length > 1) {
          const mid = Math.ceil(symbols.length / 2);
          const left = await fetchChunk(symbols.slice(0, mid), stats);
          const right = await fetchChunk(symbols.slice(mid), stats);
          return [...left, ...right];
        }
        stats.failed += symbols.length;
        stats.error = `HTTP ${res.status} from ${PRICE_SOURCE} (${symbols[0]})`;
        return [];
      }

      const json = (await res.json()) as {
        spark?: { result?: Array<{ response?: Array<{ meta?: SparkMeta }> }> };
      };
      const out: BatchQuote[] = [];
      for (const row of json.spark?.result ?? []) {
        const meta = row.response?.[0]?.meta;
        const symbol = meta?.symbol?.toUpperCase();
        const price = meta?.regularMarketPrice;
        if (!symbol || typeof price !== "number" || price <= 0) continue;
        out.push({
          symbol,
          price,
          dayHigh: typeof meta?.regularMarketDayHigh === "number" ? meta.regularMarketDayHigh : null,
          dayLow: typeof meta?.regularMarketDayLow === "number" ? meta.regularMarketDayLow : null,
          prevClose: typeof meta?.chartPreviousClose === "number" ? meta.chartPreviousClose : null,
          quoteTime: meta?.regularMarketTime
            ? new Date(meta.regularMarketTime * 1000).toISOString()
            : null,
        });
      }
      stats.succeeded += out.length;
      stats.failed += Math.max(0, symbols.length - out.length);
      return out;
    } catch (e) {
      if (attempt === MAX_ATTEMPTS) {
        stats.failed += symbols.length;
        stats.error = e instanceof Error ? e.message : "Feed unreachable";
        return [];
      }
      await sleep(Math.min(1000 * 2 ** attempt, 10_000));
    }
  }
  return [];
}

/**
 * Deduplicates the symbol set, fetches it in the fewest possible requests,
 * stores every quote in latest_prices, and logs per-run stats.
 */
export async function refreshLatestPrices(
  rawSymbols: string[],
): Promise<{ quotes: Map<string, BatchQuote>; stats: PriceRunStats }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const symbols = [...new Set(rawSymbols.map((s) => s.trim().toUpperCase()).filter(Boolean))];

  const stats: PriceRunStats = {
    source: PRICE_SOURCE,
    symbolsRequested: symbols.length,
    requestsMade: 0,
    rateLimited: 0,
    succeeded: 0,
    failed: 0,
    ok: true,
    error: null,
  };

  const quotes = new Map<string, BatchQuote>();
  if (symbols.length === 0) {
    await logRun(stats);
    return { quotes, stats };
  }

  const fetchTime = new Date().toISOString();
  for (const group of chunk(symbols, MAX_SYMBOLS_PER_REQUEST)) {
    const rows = await fetchChunk(group, stats);
    for (const q of rows) quotes.set(q.symbol, q);
  }
  stats.ok = quotes.size > 0;

  if (quotes.size > 0) {
    const { error } = await supabaseAdmin.from("latest_prices").upsert(
      [...quotes.values()].map((q) => ({
        symbol: q.symbol,
        price: q.price,
        day_high: q.dayHigh,
        day_low: q.dayLow,
        prev_close: q.prevClose,
        quote_time: q.quoteTime,
        fetch_time: fetchTime,
        source: PRICE_SOURCE,
        updated_at: fetchTime,
      })),
      { onConflict: "symbol" },
    );
    if (error) {
      stats.ok = false;
      stats.error = error.message;
    }
  }

  await logRun(stats);
  return { quotes, stats };
}

async function logRun(stats: PriceRunStats) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("price_fetch_runs").insert({
    source: stats.source,
    symbols_requested: stats.symbolsRequested,
    requests_made: stats.requestsMade,
    rate_limited: stats.rateLimited,
    succeeded: stats.succeeded,
    failed: stats.failed,
    ok: stats.ok,
    error: stats.error,
  });
}

/**
 * Reads the shared price store and batch-refreshes any symbol that is missing
 * or older than `maxAgeMs`. This is the ONLY path to the provider.
 */
export async function quotesFor(
  rawSymbols: string[],
  maxAgeMs = 15 * 60_000,
): Promise<Map<string, BatchQuote>> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const symbols = [...new Set(rawSymbols.map((s) => s.trim().toUpperCase()).filter(Boolean))];
  const out = new Map<string, BatchQuote>();
  if (symbols.length === 0) return out;

  const { data } = await supabaseAdmin
    .from("latest_prices")
    .select("symbol,price,day_high,day_low,prev_close,quote_time,fetch_time")
    .in("symbol", symbols);

  const cutoff = Date.now() - maxAgeMs;
  const stale: string[] = [];
  const bySymbol = new Map(
    (data ?? []).map((r) => [
      r.symbol,
      {
        row: r,
        fresh: new Date(r.fetch_time).getTime() >= cutoff,
      },
    ]),
  );
  for (const s of symbols) {
    const hit = bySymbol.get(s);
    if (!hit) {
      stale.push(s);
      continue;
    }
    out.set(s, {
      symbol: s,
      price: Number(hit.row.price),
      dayHigh: hit.row.day_high != null ? Number(hit.row.day_high) : null,
      dayLow: hit.row.day_low != null ? Number(hit.row.day_low) : null,
      prevClose: hit.row.prev_close != null ? Number(hit.row.prev_close) : null,
      quoteTime: hit.row.quote_time,
    });
    if (!hit.fresh) stale.push(s);
  }

  if (stale.length > 0) {
    const { quotes } = await refreshLatestPrices(stale);
    for (const [sym, q] of quotes) out.set(sym, q);
  }
  return out;
}
