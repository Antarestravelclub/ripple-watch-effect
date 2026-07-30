// Central registry describing how every ticker used in the app maps to a
// real, quotable market symbol.
//
// - `display`   what we render to the user (with exchange suffix for non-US)
// - `quote`     the symbol we actually ask the price source for
// - `listing`   where the primary line trades
// - `alt`       a liquid US-listed ADR / sector ETF the user can actually reach
// - `tradable`  false => not publicly traded, must never be displayed as a pick
//
// Client-safe: no secrets, no server imports.

export type Listing = "US" | "EU" | "UK" | "JP" | "AU" | "CA" | "CN";

export interface TickerMeta {
  /** Symbol as written in event data. */
  key: string;
  display: string;
  quote: string;
  listing: Listing;
  name?: string;
  tradable: boolean;
  /** Why it is not tradable (shown in the review report). */
  note?: string;
  alt?: { ticker: string; label: string };
}

const REGISTRY: Record<string, Omit<TickerMeta, "key">> = {
  // --- Not publicly traded -------------------------------------------------
  EPIC: {
    display: "Epic Games",
    quote: "",
    listing: "US",
    tradable: false,
    note: "Privately held — no listed equity.",
  },

  // --- EU / non-US primary listings ---------------------------------------
  LVMH: {
    display: "MC.PA",
    quote: "LVMUY",
    listing: "EU",
    name: "LVMH Moët Hennessy Louis Vuitton",
    tradable: true,
    alt: { ticker: "LVMUY", label: "US ADR" },
  },
  VNA: {
    display: "VNA.DE",
    quote: "VNNVF",
    listing: "EU",
    name: "Vonovia SE",
    tradable: true,
    alt: { ticker: "EWG", label: "Germany ETF" },
  },
  BNP: {
    display: "BNP.PA",
    quote: "BNPQY",
    listing: "EU",
    name: "BNP Paribas",
    tradable: true,
    alt: { ticker: "BNPQY", label: "US ADR" },
  },

  // --- Non-US companies that already trade as US ADRs ----------------------
  SAP: { display: "SAP", quote: "SAP", listing: "EU", name: "SAP SE (NYSE ADR)", tradable: true },
  RELX: { display: "RELX", quote: "RELX", listing: "UK", name: "RELX plc (NYSE ADR)", tradable: true },
  DB: { display: "DB", quote: "DB", listing: "EU", name: "Deutsche Bank (NYSE ADR)", tradable: true },
  BHP: { display: "BHP", quote: "BHP", listing: "AU", name: "BHP Group (NYSE ADR)", tradable: true },
  RIO: { display: "RIO", quote: "RIO", listing: "UK", name: "Rio Tinto (NYSE ADR)", tradable: true },
  NTR: { display: "NTR", quote: "NTR", listing: "CA", name: "Nutrien (NYSE)", tradable: true },
};

export function tickerMeta(key: string): TickerMeta {
  const k = key.toUpperCase().trim();
  const hit = REGISTRY[k];
  if (hit) return { key: k, ...hit };
  return { key: k, display: k, quote: k, listing: "US", tradable: true };
}

/** Symbol to send to the price source ("" when the name is not quotable). */
export function quoteSymbol(key: string): string {
  return tickerMeta(key).quote;
}

/** Filters out anything that isn't a real, quotable listing. */
export function tradableTickers(keys: string[]): string[] {
  return keys.filter((k) => tickerMeta(k).tradable);
}

export function isNonUsListing(key: string): boolean {
  return tickerMeta(key).listing !== "US";
}

export const LISTING_LABEL: Record<Listing, string> = {
  US: "US-listed",
  EU: "EU-listed",
  UK: "UK-listed",
  JP: "JP-listed",
  AU: "AU-listed",
  CA: "CA-listed",
  CN: "CN-listed",
};
