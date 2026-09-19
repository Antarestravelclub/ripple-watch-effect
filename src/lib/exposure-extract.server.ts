// Server-only exposure extraction via the swappable AI provider module.
// Uses plain JSON-mode completion + tolerant normalization so a slightly
// off-shape model answer still yields usable exposure rows.
import { EXPOSURE_SYSTEM_PROMPT, normalizeImpact, type ArticleImpact } from "./exposure-schema";

import { chatJSON } from "./ai-provider.server";

const SHAPE = `Reply with ONLY a JSON object of this exact shape:
{
  "headline": string,
  "summary": string,
  "category": "Geopolitical" | "Central Bank" | "Commodity" | "Regulation" | "Tech" | "Weather/Disaster",
  "regions": string[],
  "transmissionChannel": string,
  "strength": "Low" | "Medium" | "High",
  "positive": [{ "ticker": string, "company": string, "sector": string, "mechanism": string, "confidence": "Low" | "Medium" | "High" }],
  "negative": [{ "ticker": string, "company": string, "sector": string, "mechanism": string, "confidence": "Low" | "Medium" | "High" }],
  "caveats": string
}
Use real primary exchange tickers (prefer US-listed lines or ADRs). If the article has no meaningful listed-equity exposure, return empty positive and negative arrays.`;

function parseJsonLoose(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("Model did not return JSON");
  }
}

export async function extractExposure(text: string): Promise<ArticleImpact> {
  const content = await chatJSON(
    `${EXPOSURE_SYSTEM_PROMPT}\n\n${SHAPE}`,
    `Analyse this article:\n\n${text}`,
  );
  return normalizeImpact(parseJsonLoose(content));
}
