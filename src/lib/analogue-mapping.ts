import type { EventCategory } from "./ripple-data";
import type { Archetype, ReactionRole } from "./analogues.functions";

/** Map the live-event category to plausible historical archetypes. */
export function categoryToArchetypes(category: EventCategory): Archetype[] {
  switch (category) {
    case "Geopolitical":
      return ["armed_conflict", "terror_attack", "political_instability"];
    case "Central Bank":
      return ["commodity_shock"];
    case "Commodity":
      return ["commodity_shock", "supply_chain_disruption"];
    case "Regulation":
      return ["regulatory_action"];
    case "Tech":
      return ["cyber_attack", "regulatory_action"];
    case "Weather/Disaster":
      return ["natural_disaster"];
  }
}

export const ARCHETYPE_LABEL: Record<Archetype, string> = {
  armed_conflict: "Armed conflict",
  terror_attack: "Terror attack",
  natural_disaster: "Natural disaster",
  industrial_accident: "Industrial accident",
  regulatory_action: "Regulatory action",
  supply_chain_disruption: "Supply chain disruption",
  political_instability: "Political instability",
  pandemic_health: "Pandemic / health",
  cyber_attack: "Cyber attack",
  commodity_shock: "Commodity shock",
};

export const ROLE_LABEL: Record<ReactionRole, string> = {
  direct_loser: "Direct loser",
  direct_winner: "Direct winner",
  substitute_winner: "Substitute winner",
  second_order_winner: "2nd-order winner",
  second_order_loser: "2nd-order loser",
};

export function roleTone(role: ReactionRole): string {
  switch (role) {
    case "direct_loser":
      return "bg-headwind/15 text-headwind border-headwind/30";
    case "direct_winner":
      return "bg-tailwind/15 text-tailwind border-tailwind/30";
    case "substitute_winner":
      return "bg-primary/15 text-primary border-primary/30";
    case "second_order_winner":
      return "bg-muted text-tailwind/80 border-border/60";
    case "second_order_loser":
      return "bg-muted text-headwind/80 border-border/60";
  }
}

export function formatWindow(days: number): string {
  if (days <= 1) return "1 session";
  if (days <= 5) return `${days} sessions`;
  if (days < 30) return `${days} days`;
  if (days < 365) return `${Math.round(days / 30)} months`;
  return `${(days / 365).toFixed(1)} years`;
}

export function formatPct(v: number): string {
  const s = v > 0 ? "+" : "";
  return `${s}${v.toFixed(1)}%`;
}
