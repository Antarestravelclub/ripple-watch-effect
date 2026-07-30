// Server-only price repair/validation helpers for tracked signals.
// Fetches with pacing so we stay inside the market feed's rate limit and
// records *why* a quote failed instead of silently leaving a null price.

export type FetchStatus =
  | "ok"
  | "no_key"
  | "rate_limited"
  | "unsupported_symbol"
  | "network_error"
  | "not_tradable";

export interface FetchOutcome {
  price: number | null;
  status: FetchStatus;
  message: string | null;
}

const BASE = "https://finnhub.io/api/v1";

export async function fetchQuoteDetailed(
  symbol: string,
  apiKey: string,
): Promise<FetchOutcome> {
  if (!symbol) return { price: null, status: "not_tradable", message: "No listed symbol" };
  if (!apiKey)
    return { price: null, status: "no_key", message: "Market feed key not configured" };
  try {
    const res = await fetch(
      `${BASE}/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`,
    );
    if (res.status === 429)
      return { price: null, status: "rate_limited", message: "Feed rate limit hit" };
    if (res.status === 401 || res.status === 403)
      return { price: null, status: "no_key", message: "Market feed key rejected" };
    if (!res.ok)
      return {
        price: null,
        status: "network_error",
        message: `Feed HTTP ${res.status}`,
      };
    const j = (await res.json()) as { c?: number };
    if (typeof j.c !== "number" || j.c <= 0)
      return {
        price: null,
        status: "unsupported_symbol",
        message: "Symbol not covered by the feed",
      };
    return { price: j.c, status: "ok", message: null };
  } catch (e) {
    return {
      price: null,
      status: "network_error",
      message: e instanceof Error ? e.message : "Feed unreachable",
    };
  }
}

/** Retries once on a rate-limit response after a short pause. */
export async function fetchQuoteWithRetry(
  symbol: string,
  apiKey: string,
): Promise<FetchOutcome> {
  const first = await fetchQuoteDetailed(symbol, apiKey);
  if (first.status !== "rate_limited") return first;
  await sleep(1500);
  return fetchQuoteDetailed(symbol, apiKey);
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function derivedLevels(price: number, direction: "long" | "short") {
  return direction === "long"
    ? { target: +(price * 1.1).toFixed(4), invalidation: +(price * 0.92).toFixed(4) }
    : { target: +(price * 0.9).toFixed(4), invalidation: +(price * 1.08).toFixed(4) };
}

/** Resolves many symbols, paced to ~1 request per 250ms with a shared cache. */
export async function resolveMany(
  symbols: string[],
  apiKey: string,
): Promise<Map<string, FetchOutcome>> {
  const out = new Map<string, FetchOutcome>();
  for (const s of [...new Set(symbols)]) {
    out.set(s, await fetchQuoteWithRetry(s, apiKey));
    await sleep(250);
  }
  return out;
}
