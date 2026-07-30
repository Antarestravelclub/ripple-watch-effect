import { createServerFn } from "@tanstack/react-start";

export const searchTickers = createServerFn({ method: "POST" })
  .inputValidator((data: { q: string }) => ({ q: String(data.q ?? "").slice(0, 40) }))
  .handler(async ({ data }) => {
    const apiKey = process.env.FINNHUB_API_KEY;
    if (!apiKey || data.q.trim().length < 1) return { matches: [] };
    const { searchSymbols } = await import("./quotes.server");
    return { matches: await searchSymbols(data.q.trim(), apiKey) };
  });

export const getQuote = createServerFn({ method: "POST" })
  .inputValidator((data: { ticker: string }) => ({
    ticker: String(data.ticker ?? "").toUpperCase().slice(0, 12),
  }))
  .handler(async ({ data }) => {
    const apiKey = process.env.FINNHUB_API_KEY;
    if (!apiKey || !data.ticker) return { quote: null, profile: null };
    const { fetchQuote, fetchProfile } = await import("./quotes.server");
    const [quote, profile] = await Promise.all([
      fetchQuote(data.ticker, apiKey),
      fetchProfile(data.ticker, apiKey),
    ]);
    return { quote, profile };
  });

export const getQuotes = createServerFn({ method: "POST" })
  .inputValidator((data: { tickers: string[] }) => ({
    tickers: (data.tickers ?? [])
      .slice(0, 25)
      .map((t) => String(t).toUpperCase().slice(0, 12))
      .filter(Boolean),
  }))
  .handler(async ({ data }) => {
    const apiKey = process.env.FINNHUB_API_KEY;
    if (!apiKey) return { quotes: {} as Record<string, unknown> };
    const { fetchQuote } = await import("./quotes.server");
    const entries = await Promise.all(
      data.tickers.map(async (t) => [t, await fetchQuote(t, apiKey)] as const),
    );
    return { quotes: Object.fromEntries(entries) };
  });
