// Historical analogue hit rates: of comparable past events, how often did this
// ticker move in the direction the signal expects?
import { categoryToArchetypes } from "./analogue-mapping";
import type { EventCategory } from "./ripple-data";

interface ReactionLite {
  ticker: string;
  direction: "up" | "down";
  archetype: string;
}

let cache: { at: number; rows: ReactionLite[] } | null = null;
const TTL_MS = 10 * 60_000;

async function allReactions(): Promise<ReactionLite[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.rows;
  try {
    const { publicSupabase } = await import("./supabase-public.server");
    const supabase = publicSupabase();
    const { data } = await supabase
      .from("historical_reactions")
      .select("ticker,direction,historical_events(archetype)");
    const rows: ReactionLite[] = ((data ?? []) as unknown as Array<{
      ticker: string;
      direction: "up" | "down";
      historical_events: { archetype: string } | null;
    }>)
      .filter((r) => r.historical_events?.archetype)
      .map((r) => ({
        ticker: (r.ticker ?? "").toUpperCase(),
        direction: r.direction,
        archetype: r.historical_events!.archetype,
      }));
    cache = { at: Date.now(), rows };
    return rows;
  } catch {
    return [];
  }
}

/**
 * Share (0–1) of comparable past reactions where the ticker moved the signal's
 * way. Null when there is no comparable history for this ticker + archetype.
 */
export async function analogueHitRate(
  ticker: string,
  direction: "long" | "short",
  category: EventCategory,
): Promise<number | null> {
  const rows = await allReactions();
  if (rows.length === 0) return null;
  const archetypes = new Set(categoryToArchetypes(category));
  const t = ticker.toUpperCase();
  const matching = rows.filter((r) => r.ticker === t && archetypes.has(r.archetype as never));
  if (matching.length === 0) return null;
  const want = direction === "long" ? "up" : "down";
  const hits = matching.filter((r) => r.direction === want).length;
  return hits / matching.length;
}
