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

const ExposureRow = z.object({
  ticker: z.string().default(""),
  company: z.string().default(""),
  sector: z.string().default(""),
  mechanism: z.string().default(""),
  confidence: z.string().default("Medium").transform(normalizeLevel),
});

export const ArticleImpactSchema = z.object({
  headline: z.string().default(""),
  summary: z.string().default(""),
  category: z.string().default("Geopolitical"),
  regions: z.array(z.string()).default([]),
  transmissionChannel: z.string().default(""),
  strength: z.string().default("Medium").transform(normalizeLevel),
  positive: z.array(ExposureRow).default([]),
  negative: z.array(ExposureRow).default([]),
  caveats: z.string().default(""),
});

export type ArticleImpact = z.infer<typeof ArticleImpactSchema>;

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
