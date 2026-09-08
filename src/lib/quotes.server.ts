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

export const QUOTE_PROVIDER = "Finnhub (finnhub.io)";

export interface FeedDiagnostics {
  provider: string;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
  attempts: number;
  successes: number;
  failures: number;
  cachedSymbols: number;
}

/** Per-isolate feed telemetry. Survives across requests in the same worker. */
const diag = {
  lastAttemptAt: null as string | null,
  lastSuccessAt: null as string | null,
  lastErrorAt: null as string | null,
  lastError: null as string | null,
  attempts: 0,
  successes: 0,
  failures: 0,
};

export function getFeedDiagnostics(): FeedDiagnostics {
  return { provider: QUOTE_PROVIDER, ...diag, cachedSymbols: quoteCache.size };
}

/** Short-lived quote cache — keeps burst refreshes under the provider's limit. */
const quoteCache = new Map<string, { quote: Quote; at: number }>();
const CACHE_TTL_MS = 15_000;

type Fetched<T> = { data: T | null; status: QuoteStatus; error?: string };

async function get<T>(path: string, apiKey: string): Promise<Fetched<T>> {
  diag.attempts += 1;
  diag.lastAttemptAt = new Date().toISOString();
  const fail = (status: QuoteStatus, error: string): Fetched<T> => {
    diag.failures += 1;
    diag.lastErrorAt = new Date().toISOString();
    diag.lastError = error;
    return { data: null, status, error };
  };
  try {
    const res = await fetch(`${BASE}${path}&token=${apiKey}`);
    if (!res.ok) {
      const body = (await res.text().catch(() => "")).slice(0, 180);
      const detail = `HTTP ${res.status}${body ? ` — ${body}` : ""}`;
      if (res.status === 429) return fail("rate_limited", detail);
      if (res.status === 401 || res.status === 403) return fail("no_key", detail);
      return fail("unsupported_symbol", detail);
    }
    const data = (await res.json()) as T;
    diag.successes += 1;
    diag.lastSuccessAt = new Date().toISOString();
    diag.lastError = null;
    return { data, status: "ok" };
  } catch (e) {
    return fail("network_error", e instanceof Error ? e.message : "network error");
  }
}

/**
 * Batch quotes with bounded concurrency and a short cache, so a page with many
 * tickers cannot exhaust the provider's per-minute allowance.
 */
export async function fetchQuotesBatch(
  tickers: string[],
  apiKey: string,
): Promise<{ quotes: Record<string, Quote | null>; status: QuoteStatus }> {
  const out: Record<string, Quote | null> = {};
  let status: QuoteStatus = "ok";
  const pending: string[] = [];
  const now = Date.now();
  for (const t of tickers) {
    const hit = quoteCache.get(t);
    if (hit && now - hit.at < CACHE_TTL_MS) out[t] = hit.quote;
    else pending.push(t);
  }
  const CONCURRENCY = 3;
  for (let i = 0; i < pending.length; i += CONCURRENCY) {
    const slice = pending.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      slice.map(async (t) => [t, await fetchQuote(t, apiKey)] as const),
    );
    for (const [t, r] of results) {
      out[t] = r.quote;
      if (r.quote) quoteCache.set(t, { quote: r.quote, at: Date.now() });
      if (r.status === "rate_limited" || r.status === "no_key") status = r.status;
      else if (r.status === "network_error" && status === "ok") status = r.status;
    }
    // Stop hammering a provider that is already refusing us.
    if (status === "rate_limited" || status === "no_key") {
      for (const t of pending.slice(i + CONCURRENCY)) {
        const hit = quoteCache.get(t);
        out[t] = hit?.quote ?? null;
      }
      break;
    }
  }
  return { quotes: out, status };
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

/** NYSE full-day closures (America/New_York calendar dates, YYYY-MM-DD). */
const US_MARKET_HOLIDAYS = new Set<string>([
  // 2025
  "2025-01-01","2025-01-09","2025-01-20","2025-02-17","2025-04-18","2025-05-26",
  "2025-06-19","2025-07-04","2025-09-01","2025-11-27","2025-12-25",
  // 2026
  "2026-01-01","2026-01-19","2026-02-16","2026-04-03","2026-05-25","2026-06-19",
  "2026-07-03","2026-09-07","2026-11-26","2026-12-25",
  // 2027
  "2027-01-01","2027-01-18","2027-02-15","2027-03-26","2027-05-31","2027-06-18",
  "2027-07-05","2027-09-06","2027-11-25","2027-12-24",
]);

/** Early closes (1:00pm ET) — day after Thanksgiving, Christmas Eve, July 3 etc. */
const US_MARKET_HALF_DAYS = new Set<string>([
  "2025-07-03","2025-11-28","2025-12-24",
  "2026-11-27","2026-12-24",
  "2027-11-26",
]);

/** Wall-clock parts of `now` in America/New_York, DST-aware. */
function newYorkParts(now: Date) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  });
  const p: Record<string, string> = {};
  for (const part of fmt.formatToParts(now)) p[part.type] = part.value;
  const hour = p.hour === "24" ? 0 : Number(p.hour);
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    weekday: p.weekday,
    minutes: hour * 60 + Number(p.minute),
  };
}

/**
 * US regular session check in exchange local time (America/New_York, DST-aware):
 * 9:30–16:00 Mon–Fri, excluding NYSE holidays; 9:30–13:00 on half days.
 * Only the listed dates are closed, so the day after a holiday is open.
 */
export function isUsMarketOpen(now = new Date()): boolean {
  const { date, weekday, minutes } = newYorkParts(now);
  if (weekday === "Sat" || weekday === "Sun") return false;
  if (US_MARKET_HOLIDAYS.has(date)) return false;
  const close = US_MARKET_HALF_DAYS.has(date) ? 13 * 60 : 16 * 60;
  return minutes >= 9 * 60 + 30 && minutes < close;
}

