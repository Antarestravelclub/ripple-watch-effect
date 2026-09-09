// Instrument classification shared by signals, trades and UI.
// Client-safe: types and pure helpers only.

export type InstrumentType = "stock" | "etf";

export const INSTRUMENT_LABEL: Record<InstrumentType, string> = {
  stock: "Stocks",
  etf: "ETFs",
};

export type InstrumentFilter = "all" | InstrumentType;

/** Applies an All / Stocks / ETFs filter to anything carrying an instrument type. */
export function matchesInstrument(
  filter: InstrumentFilter,
  type: InstrumentType | null | undefined,
): boolean {
  if (filter === "all") return true;
  return (type ?? "stock") === filter;
}

export type EtfCategory =
  | "sector"
  | "country"
  | "commodity"
  | "broad_market"
  | "bond"
  | "currency";

export const ETF_CATEGORY_LABEL: Record<EtfCategory, string> = {
  sector: "Sector",
  country: "Country / region",
  commodity: "Commodity",
  broad_market: "Broad market",
  bond: "Bond",
  currency: "Currency",
};

export interface EtfReferenceRow {
  id: string;
  ticker: string;
  name: string;
  category: EtfCategory;
  theme_keywords: string[];
  leveraged: boolean;
  inverse: boolean;
  active: boolean;
  feed_error: string | null;
}

/** Leveraged and inverse funds reset daily and never enter the signal universe. */
export function isExcludedEtf(row: Pick<EtfReferenceRow, "leveraged" | "inverse">): boolean {
  return row.leveraged || row.inverse;
}

export const ETF_EXCLUSION_NOTE =
  "Leveraged and inverse funds are kept for reference but never suggested: their daily reset " +
  "decays over multi-day holds, so our ATR stop and target model does not apply. A bearish view " +
  "is expressed as a short signal on the plain fund instead.";
