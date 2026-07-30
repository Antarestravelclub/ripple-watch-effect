// Server-only Finnhub helpers. Never imported from client code.

export interface SymbolMatch {
  symbol: string;
  description: string;
  type: string;
}

export interface Quote {
  price: number;
  change: number;
  changePct: number;
  high: number;
  low: number;
  open: number;
  prevClose: number;
  at: string;
}

export interface Profile {
  name: string | null;
  exchange: string | null;
  industry: string | null;
  currency: string | null;
}

const BASE = "https://finnhub.io/api/v1";

async function get<T>(path: string, apiKey: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}&token=${apiKey}`);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function searchSymbols(
  q: string,
  apiKey: string,
): Promise<SymbolMatch[]> {
  const json = await get<{ result?: Array<Record<string, string>> }>(
    `/search?q=${encodeURIComponent(q)}&exchange=US`,
    apiKey,
  );
  return (json?.result ?? [])
    .filter((r) => r.symbol && !r.symbol.includes("."))
    .slice(0, 8)
    .map((r) => ({
      symbol: r.symbol,
      description: r.description ?? "",
      type: r.type ?? "",
    }));
}

export async function fetchQuote(
  ticker: string,
  apiKey: string,
): Promise<Quote | null> {
  const json = await get<Record<string, number>>(
    `/quote?symbol=${encodeURIComponent(ticker)}&x=1`,
    apiKey,
  );
  if (!json || typeof json.c !== "number" || json.c === 0) return null;
  return {
    price: json.c,
    change: json.d ?? 0,
    changePct: json.dp ?? 0,
    high: json.h ?? 0,
    low: json.l ?? 0,
    open: json.o ?? 0,
    prevClose: json.pc ?? 0,
    at: new Date((json.t ? json.t * 1000 : Date.now())).toISOString(),
  };
}

export async function fetchProfile(
  ticker: string,
  apiKey: string,
): Promise<Profile | null> {
  const json = await get<Record<string, string>>(
    `/stock/profile2?symbol=${encodeURIComponent(ticker)}&x=1`,
    apiKey,
  );
  if (!json || !json.name) return null;
  return {
    name: json.name ?? null,
    exchange: json.exchange ?? null,
    industry: json.finnhubIndustry ?? null,
    currency: json.currency ?? null,
  };
}
