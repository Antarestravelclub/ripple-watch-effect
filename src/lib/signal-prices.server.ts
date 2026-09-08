// Server-only price access for tracked signals.
//
// These helpers no longer talk to a market-data provider directly. Every price
// comes from the shared latest_prices store (see latest-prices.server.ts),
// which is filled by ONE batched, rate-limit-aware fetch per cron run.

import { quotesFor } from "./latest-prices.server";

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
  dayHigh?: number | null;
  dayLow?: number | null;
}

/** Single-symbol read from the shared store (batched refresh under the hood). */
export async function fetchQuoteDetailed(symbol: string): Promise<FetchOutcome> {
  if (!symbol) return { price: null, status: "not_tradable", message: "No listed symbol" };
  const map = await resolveMany([symbol]);
  return (
    map.get(symbol.toUpperCase()) ?? {
      price: null,
      status: "unsupported_symbol",
      message: "No stored price for this symbol",
    }
  );
}

/** Kept for call-site compatibility; the store already handles backoff. */
export const fetchQuoteWithRetry = fetchQuoteDetailed;

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function derivedLevels(price: number, direction: "long" | "short") {
  return direction === "long"
    ? { target: +(price * 1.1).toFixed(4), invalidation: +(price * 0.92).toFixed(4) }
    : { target: +(price * 0.9).toFixed(4), invalidation: +(price * 1.08).toFixed(4) };
}

/** Resolves many symbols in the fewest possible provider requests. */
export async function resolveMany(
  symbols: string[],
): Promise<Map<string, FetchOutcome>> {
  const wanted = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))];
  const out = new Map<string, FetchOutcome>();
  if (wanted.length === 0) return out;

  const quotes = await quotesFor(wanted);
  for (const sym of wanted) {
    const q = quotes.get(sym);
    out.set(
      sym,
      q
        ? {
            price: q.price,
            status: "ok",
            message: null,
            dayHigh: q.dayHigh,
            dayLow: q.dayLow,
          }
        : {
            price: null,
            status: "unsupported_symbol",
            message: "No price available from the batched feed",
          },
    );
  }
  return out;
}
