// Server-side magnitude lookup: live (ingested) events first, curated events as fallback.
import { EVENTS } from "./ripple-data";
import type { RippleStrength } from "./ripple-data";

export async function eventMagnitudes(): Promise<Map<string, RippleStrength>> {
  const map = new Map<string, RippleStrength>(
    EVENTS.map((e) => [e.id, e.strength as RippleStrength]),
  );
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("live_events")
      .select("id,strength");
    for (const row of (data ?? []) as Array<{ id: string; strength: string }>) {
      map.set(row.id, (row.strength as RippleStrength) ?? "Medium");
    }
  } catch {
    // Fall back to curated magnitudes.
  }
  return map;
}
