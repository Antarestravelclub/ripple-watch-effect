// ETF universe reads and event → ETF theme matching.
// Server-only: uses the privileged client for reference reads.
import type { EtfCategory, EtfReferenceRow } from "./instrument";

export interface EtfMatch {
  row: EtfReferenceRow;
  score: number;
  matched: string[];
}

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const SELECT = "id,ticker,name,category,theme_keywords,leveraged,inverse,active,feed_error";

/** Every reference row, flagged ones included (admin views, universe reports). */
export async function allEtfRows(): Promise<EtfReferenceRow[]> {
  const supabase = await db();
  const { data, error } = await supabase.from("etf_reference").select(SELECT).order("ticker");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as EtfReferenceRow[];
}

/**
 * Suggestable universe: active, and never leveraged or inverse. The exclusion
 * is enforced here so no caller can accidentally suggest a decaying product.
 */
export async function suggestableEtfs(): Promise<EtfReferenceRow[]> {
  const supabase = await db();
  const { data, error } = await supabase
    .from("etf_reference")
    .select(SELECT)
    .eq("active", true)
    .eq("leveraged", false)
    .eq("inverse", false)
    .order("ticker");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as EtfReferenceRow[];
}

/** Uppercased tickers of every reference row — used to classify tickers as ETFs. */
export async function etfTickerSet(): Promise<Set<string>> {
  const rows = await allEtfRows();
  return new Set(rows.map((r) => r.ticker.toUpperCase()));
}

/** App event category → the ETF categories it most naturally transmits through. */
const CATEGORY_AFFINITY: Record<string, EtfCategory[]> = {
  Commodity: ["commodity", "sector"],
  Geopolitical: ["country", "commodity", "sector"],
  "Central Bank": ["bond", "currency", "broad_market"],
  Regulation: ["sector", "country"],
  Tech: ["sector"],
  "Weather/Disaster": ["commodity", "sector", "country"],
};

function occurs(haystack: string, needle: string): boolean {
  const n = needle.trim().toLowerCase();
  if (n.length < 3) return false;
  if (n.includes(" ")) return haystack.includes(n);
  return new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(haystack);
}

/**
 * Keyword/category match between an event's text and the ETF reference list.
 * Deterministic and cheap — it only decides which funds are *considered*; the
 * usual conviction rubric, ATR levels and sizing still decide the signal.
 */
export function matchEtfs(
  rows: EtfReferenceRow[],
  eventText: string,
  category: string,
  max = 3,
): EtfMatch[] {
  const text = eventText.toLowerCase();
  const affinity = CATEGORY_AFFINITY[category] ?? [];

  const scored = rows.map((row) => {
    const matched = (row.theme_keywords ?? []).filter((k) => occurs(text, k));
    // Multi-word themes are far more specific than single words, so weight them.
    let score = matched.reduce((s, k) => s + (k.includes(" ") ? 2 : 1), 0);
    if (score > 0 && affinity.includes(row.category)) score += 1;
    return { row, score, matched };
  });

  return scored
    .filter((m) => m.score >= 2)
    .sort((a, b) => b.score - a.score || a.row.ticker.localeCompare(b.row.ticker))
    .slice(0, Math.max(0, max));
}

/** Convenience wrapper: load the suggestable universe and match one event. */
export async function matchEtfsForEvent(
  eventText: string,
  category: string,
  max = 3,
): Promise<EtfMatch[]> {
  const rows = await suggestableEtfs();
  return matchEtfs(rows, eventText, category, max);
}
