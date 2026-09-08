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

export const getQuotes = createServerFn({ method: "POST" })
  .inputValidator((data: { tickers: string[] }) => ({
    tickers: (data.tickers ?? [])
      .slice(0, 25)
      .map((t) => String(t).toUpperCase().slice(0, 16))
      .filter(Boolean),
  }))
  .handler(async ({ data }) => {
    const apiKey = process.env.FINNHUB_API_KEY;
    const { fetchQuotesBatch, isUsMarketOpen, getFeedDiagnostics, QUOTE_PROVIDER } =
      await import("./quotes.server");
    type Q = Awaited<ReturnType<typeof fetchQuotesBatch>>["quotes"][string];
    if (!apiKey)
      return {
        quotes: {} as Record<string, Q>,
        status: "no_key" as const,
        marketOpen: false,
        at: new Date().toISOString(),
        diagnostics: {
          provider: QUOTE_PROVIDER,
          lastAttemptAt: null,
          lastSuccessAt: null,
          lastErrorAt: new Date().toISOString(),
          lastError: "No provider API key configured",
          attempts: 0,
          successes: 0,
          failures: 0,
          cachedSymbols: 0,
        },
      };
    const { quotes, status } = await fetchQuotesBatch(data.tickers, apiKey);
    return {
      quotes,
      status,
      marketOpen: isUsMarketOpen(),
      at: new Date().toISOString(),
      diagnostics: getFeedDiagnostics(),
    };
  });

