// Shared exposure-extraction schema used by both the Article Analyser and the
// automated news ingestion job. Client-safe (types + zod only).
import { z } from "zod";

/** Tolerant level parsing — models often answer "medium-high", "moderate", etc. */
export function normalizeLevel(raw: unknown): "Low" | "Medium" | "High" {
  const v = String(raw ?? "").toLowerCase();
  if (v.startsWith("h") || v.includes("strong") || v.includes("severe")) return "High";
  if (v.startsWith("l") || v.includes("weak") || v.includes("minor")) return "Low";
  return "Medium";
}

/**
 * Wire schema handed to the model: plain strings only, no enums or transforms,
 * so a slightly-off answer still parses instead of being thrown away.
 */
const WireRow = z.object({
  ticker: z.string(),
  company: z.string(),
  sector: z.string(),
  mechanism: z.string(),
  confidence: z.string(),
});

export const ArticleImpactWireSchema = z.object({
  headline: z.string(),
  summary: z.string(),
  category: z.string(),
  regions: z.array(z.string()),
  transmissionChannel: z.string(),
  strength: z.string(),
  positive: z.array(WireRow),
  negative: z.array(WireRow),
  caveats: z.string(),
});

export interface ExposureRow {
  ticker: string;
  company: string;
  sector: string;
  mechanism: string;
  confidence: "Low" | "Medium" | "High";
}

export interface ArticleImpact {
  headline: string;
  summary: string;
  category: string;
  regions: string[];
  transmissionChannel: string;
  strength: "Low" | "Medium" | "High";
  positive: ExposureRow[];
  negative: ExposureRow[];
  caveats: string;
}

/** Coerce a loose model answer into the app's strict shape. */
export function normalizeImpact(raw: unknown): ArticleImpact {
  const o = (raw ?? {}) as Record<string, unknown>;
  const rows = (v: unknown): ExposureRow[] =>
    (Array.isArray(v) ? v : []).map((r) => {
      const x = (r ?? {}) as Record<string, unknown>;
      return {
        ticker: String(x.ticker ?? "").trim(),
        company: String(x.company ?? "").trim(),
        sector: String(x.sector ?? "").trim(),
        mechanism: String(x.mechanism ?? "").trim(),
        confidence: normalizeLevel(x.confidence),
      };
    });
  return {
    headline: String(o.headline ?? ""),
    summary: String(o.summary ?? ""),
    category: String(o.category ?? "Geopolitical"),
    regions: Array.isArray(o.regions) ? o.regions.map(String) : [],
    transmissionChannel: String(o.transmissionChannel ?? ""),
    strength: normalizeLevel(o.strength),
    positive: rows(o.positive),
    negative: rows(o.negative),
    caveats: String(o.caveats ?? ""),
  };
}

export const EXPOSURE_SYSTEM_PROMPT = [
  "You are an equity-exposure research assistant for an educational tool.",
  "Given a news article, identify the mechanical transmission channel to listed equities.",
  "List publicly listed companies with real exchange tickers that are most positively and most negatively exposed.",
  "Explain the mechanism concretely (input costs, demand, substitution, regulation, supply chain).",
  "Never give investment advice; never use the words buy, sell, or recommendation.",
  "Describe exposure and historical behaviour only. 3-6 names per side when supportable, fewer if not.",
].join(" ");

export const EVENT_CATEGORIES = [
  "Geopolitical",
  "Central Bank",
  "Commodity",
  "Regulation",
  "Tech",
  "Weather/Disaster",
] as const;

export const REGION_CODES = ["US", "EU", "CA", "AU", "JP", "CN", "GLOBAL"] as const;

/** Coerce a free-text AI category into one of the app's fixed categories. */
export function normalizeCategory(raw: string): string {
  const v = (raw || "").toLowerCase();
  if (v.includes("bank") || v.includes("monetary") || v.includes("rate"))
    return "Central Bank";
  if (
    v.includes("commodity") ||
    v.includes("oil") ||
    v.includes("energy") ||
    v.includes("metal") ||
    v.includes("crop")
  )
    return "Commodity";
  if (v.includes("regul") || v.includes("policy") || v.includes("legal") || v.includes("tariff"))
    return "Regulation";
  if (v.includes("tech") || v.includes("chip") || v.includes("ai") || v.includes("semiconduct"))
    return "Tech";
  if (
    v.includes("weather") ||
    v.includes("disaster") ||
    v.includes("storm") ||
    v.includes("quake") ||
    v.includes("flood") ||
    v.includes("fire")
  )
    return "Weather/Disaster";
  return "Geopolitical";
}

export function normalizeRegions(raw: string[]): string[] {
  const out = new Set<string>();
  for (const r of raw ?? []) {
    const v = (r || "").toUpperCase();
    if (v.includes("US") || v.includes("UNITED STATES") || v.includes("AMERICA")) out.add("US");
    else if (v.includes("EU") || v.includes("EURO")) out.add("EU");
    else if (v.includes("CA") || v.includes("CANAD")) out.add("CA");
    else if (v.includes("AU") || v.includes("AUSTRAL")) out.add("AU");
    else if (v.includes("JP") || v.includes("JAPAN")) out.add("JP");
    else if (v.includes("CN") || v.includes("CHIN")) out.add("CN");
    else out.add("GLOBAL");
  }
  if (out.size === 0) out.add("GLOBAL");
  return [...out];
}
