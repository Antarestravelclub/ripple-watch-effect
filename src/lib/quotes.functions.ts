import { createServerFn } from "@tanstack/react-start";

export const searchTickers = createServerFn({ method: "POST" })
  .inputValidator((data: { q: string }) => ({ q: String(data.q ?? "").slice(0, 40) }))
  .handler(async ({ data }) => {
    const apiKey = process.env.FINNHUB_API_KEY;
    if (!apiKey) return { matches: [], status: "no_key" as const };
    if (data.q.trim().length < 1) return { matches: [], status: "ok" as const };
    const { searchSymbols } = await import("./quotes.server");
    return { matches: await searchSymbols(data.q.trim(), apiKey), status: "ok" as const };
  });

export const getQuote = createServerFn({ method: "POST" })
  .inputValidator((data: { ticker: string }) => ({
    ticker: String(data.ticker ?? "").toUpperCase().slice(0, 16),
  }))
  .handler(async ({ data }) => {
    const apiKey = process.env.FINNHUB_API_KEY;
    if (!apiKey)
      return { quote: null, profile: null, status: "no_key" as const, marketOpen: false };
    if (!data.ticker)
      return {
        quote: null,
        profile: null,
        status: "unsupported_symbol" as const,
        marketOpen: false,
      };
    const { fetchQuote, fetchProfile, isUsMarketOpen } = await import("./quotes.server");
    const [res, profile] = await Promise.all([
      fetchQuote(data.ticker, apiKey),
      fetchProfile(data.ticker, apiKey),
    ]);
    const quote = res.quote
      ? { ...res.quote, currency: res.quote.currency ?? profile?.currency ?? null }
      : null;
    return { quote, profile, status: res.status, marketOpen: isUsMarketOpen() };
  });

/**
 * Multi-symbol quotes, served from the shared latest_prices store. Display
 * components never call the market-data provider directly — one batched fetch
 * fills the store and everyone reads from it.
 */
export const getQuotes = createServerFn({ method: "POST" })
  .inputValidator((data: { tickers: string[] }) => ({
    tickers: (data.tickers ?? [])
      .slice(0, 60)
      .map((t) => String(t).toUpperCase().slice(0, 16))
      .filter(Boolean),
  }))
  .handler(async ({ data }) => {
    const { quotesFor } = await import("./latest-prices.server");
    const { isUsMarketOpen } = await import("./quotes.server");
    type Q = {
      price: number;
      change: number;
      changePct: number;
      high: number;
      low: number;
      open: number;
      prevClose: number;
      currency: string | null;
      at: string;
    };
    const stored = await quotesFor(data.tickers);
    const quotes: Record<string, Q | null> = {};
    for (const t of data.tickers) {
      const q = stored.get(t);
      if (!q) {
        quotes[t] = null;
        continue;
      }
      const prev = q.prevClose ?? q.price;
      quotes[t] = {
        price: q.price,
        change: +(q.price - prev).toFixed(4),
        changePct: prev ? +(((q.price - prev) / prev) * 100).toFixed(3) : 0,
        high: q.dayHigh ?? q.price,
        low: q.dayLow ?? q.price,
        open: prev,
        prevClose: prev,
        currency: null,
        at: q.quoteTime ?? new Date().toISOString(),
      };
    }
    return {
      quotes,
      status: (Object.values(quotes).some(Boolean) ? "ok" : "unsupported_symbol") as
        | "ok"
        | "unsupported_symbol",
      marketOpen: isUsMarketOpen(),
      at: new Date().toISOString(),
    };
  });


