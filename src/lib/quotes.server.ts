// Server-only market-data helpers (Finnhub). Never imported from client code.

export type QuoteStatus =
  | "ok"
  | "no_key"
  | "rate_limited"
  | "unsupported_symbol"
  | "network_error";

export interface SymbolMatch {
  symbol: string;
  description: string;
  type: string;
  exchange: string | null;
}

export interface Quote {
  price: number;
  change: number;
  changePct: number;
  high: number;
  low: number;
  open: number;
  prevClose: number;
  currency: string | null;
  at: string;
}

export interface Profile {
  name: string | null;
  exchange: string | null;
  industry: string | null;
  currency: string | null;
}

export interface QuoteResult {
  quote: Quote | null;
  status: QuoteStatus;
}

const BASE = "https://finnhub.io/api/v1";

type Fetched<T> = { data: T | null; status: QuoteStatus };

async function get<T>(path: string, apiKey: string): Promise<Fetched<T>> {
  try {
    const res = await fetch(`${BASE}${path}&token=${apiKey}`);
    if (res.status === 429) return { data: null, status: "rate_limited" };
    if (res.status === 401 || res.status === 403)
      return { data: null, status: "no_key" };
    if (!res.ok) return { data: null, status: "unsupported_symbol" };
    return { data: (await res.json()) as T, status: "ok" };
  } catch {
    return { data: null, status: "network_error" };
  }
}

/**
 * Symbol search across every exchange Finnhub knows about, so non-US
 * listings (AU, CA, EU, JP, CN) are reachable from the lookup box.
 */
export async function searchSymbols(
  q: string,
  apiKey: string,
): Promise<SymbolMatch[]> {
  const { data } = await get<{ result?: Array<Record<string, string>> }>(
    `/search?q=${encodeURIComponent(q)}&x=1`,
    apiKey,
  );
  const seen = new Set<string>();
  const rows: SymbolMatch[] = [];
  for (const r of data?.result ?? []) {
    if (!r.symbol || seen.has(r.symbol)) continue;
    seen.add(r.symbol);
    const dot = r.symbol.indexOf(".");
    rows.push({
      symbol: r.symbol,
      description: r.description ?? "",
      type: r.type ?? "",
      exchange: dot > -1 ? r.symbol.slice(dot + 1) : "US",
    });
    if (rows.length >= 12) break;
  }
  // US listings first, then the rest alphabetically.
  return rows.sort((a, b) =>
    a.exchange === b.exchange ? 0 : a.exchange === "US" ? -1 : b.exchange === "US" ? 1 : 0,
  );
}

export async function fetchQuote(
  ticker: string,
  apiKey: string,
): Promise<QuoteResult> {
  const { data, status } = await get<Record<string, number>>(
    `/quote?symbol=${encodeURIComponent(ticker)}&x=1`,
    apiKey,
  );
  if (!data || status !== "ok") return { quote: null, status };
  if (typeof data.c !== "number" || data.c === 0)
    return { quote: null, status: "unsupported_symbol" };
  return {
    status: "ok",
    quote: {
      price: data.c,
      change: data.d ?? 0,
      changePct: data.dp ?? 0,
      high: data.h ?? 0,
      low: data.l ?? 0,
      open: data.o ?? 0,
      prevClose: data.pc ?? 0,
      currency: null,
      at: new Date(data.t ? data.t * 1000 : Date.now()).toISOString(),
    },
  };
}

export async function fetchProfile(
  ticker: string,
  apiKey: string,
): Promise<Profile | null> {
  const { data } = await get<Record<string, string>>(
    `/stock/profile2?symbol=${encodeURIComponent(ticker)}&x=1`,
    apiKey,
  );
  if (!data || !data.name) return null;
  return {
    name: data.name ?? null,
    exchange: data.exchange ?? null,
    industry: data.finnhubIndustry ?? null,
    currency: data.currency ?? null,
  };
}

/** Rough US regular-session check (weekday, 13:30–20:00 UTC). */
export function isUsMarketOpen(now = new Date()): boolean {
  const day = now.getUTCDay();
  if (day === 0 || day === 6) return false;
  const mins = now.getUTCHours() * 60 + now.getUTCMinutes();
  return mins >= 13 * 60 + 30 && mins <= 20 * 60;
}
