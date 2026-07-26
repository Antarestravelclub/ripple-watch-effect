// Server functions for Historical Analogues (public read-only).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type Archetype =
  | "armed_conflict"
  | "terror_attack"
  | "natural_disaster"
  | "industrial_accident"
  | "regulatory_action"
  | "supply_chain_disruption"
  | "political_instability"
  | "pandemic_health"
  | "cyber_attack"
  | "commodity_shock";

export type ReactionRole =
  | "direct_loser"
  | "direct_winner"
  | "substitute_winner"
  | "second_order_winner"
  | "second_order_loser";

export interface HistoricalReactionRow {
  id: string;
  historical_event_id: string;
  ticker: string;
  company_name: string | null;
  exchange: string | null;
  sector: string | null;
  direction: "up" | "down";
  role: ReactionRole;
  pct_move: number;
  window_days: number;
  peak_pct_move: number | null;
  reverted: boolean;
  days_to_revert: number | null;
  notes: string | null;
}

export interface HistoricalEventRow {
  id: string;
  title: string;
  event_date: string;
  country: string | null;
  region: string | null;
  archetype: Archetype;
  transmission_channel: string;
  summary: string;
  source_url: string | null;
}

export interface PlaybookRow {
  id: string;
  archetype: Archetype;
  channel: string;
  typical_winners: string[];
  typical_losers: string[];
  typical_magnitude_range: string | null;
  typical_duration: string | null;
  confidence: number;
}

async function getClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const listAnalogues = createServerFn({ method: "GET" })
  .inputValidator((d: { archetypes?: Archetype[]; region?: string; limit?: number } | undefined) =>
    z
      .object({
        archetypes: z.array(z.string()).optional(),
        region: z.string().optional(),
        limit: z.number().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    const supabase = await getClient();
    let q = supabase.from("historical_events").select("*").order("event_date", { ascending: false });
    if (data.archetypes && data.archetypes.length > 0) {
      q = q.in("archetype", data.archetypes as Archetype[]);
    }
    if (data.region) q = q.eq("region", data.region);
    if (data.limit) q = q.limit(data.limit);
    const { data: events, error } = await q;
    if (error) throw new Error(error.message);
    const ids = (events ?? []).map((e) => e.id);
    let reactions: HistoricalReactionRow[] = [];
    if (ids.length > 0) {
      const { data: rx } = await supabase
        .from("historical_reactions")
        .select("*")
        .in("historical_event_id", ids);
      reactions = (rx ?? []) as unknown as HistoricalReactionRow[];
    }
    return {
      events: (events ?? []) as unknown as HistoricalEventRow[],
      reactions,
    };
  });

export const listPlaybooks = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = await getClient();
  const { data, error } = await supabase.from("archetype_playbooks").select("*").order("archetype");
  if (error) throw new Error(error.message);
  return { playbooks: (data ?? []) as unknown as PlaybookRow[] };
});
