// Region tagging + curated "top stock plays" per event.
// Kept in a side-table so we don't have to edit every RippleEvent record.

export const REGIONS = [
  { code: "US", label: "United States", flag: "🇺🇸" },
  { code: "EU", label: "European Union", flag: "🇪🇺" },
  { code: "CA", label: "Canada", flag: "🇨🇦" },
  { code: "AU", label: "Australia", flag: "🇦🇺" },
  { code: "JP", label: "Japan", flag: "🇯🇵" },
  { code: "CN", label: "China", flag: "🇨🇳" },
  { code: "GLOBAL", label: "Global", flag: "🌐" },
] as const;

export type RegionCode = (typeof REGIONS)[number]["code"];

export interface TopPick {
  ticker: string;
  thesis: string;
  side: "long" | "avoid"; // long = beneficiary to consider; avoid = at-risk
}

interface EventMeta {
  regions: RegionCode[];
  topPicks: TopPick[];
}

export const EVENT_META: Record<string, EventMeta> = {
  "evt-001": {
    regions: ["GLOBAL", "US", "EU", "CA"],
    topPicks: [
      { ticker: "XOM", side: "long", thesis: "Integrated major with upstream leverage to higher crude realizations." },
      { ticker: "CVX", side: "long", thesis: "Diversified oil & gas with strong free cash flow at elevated prices." },
      { ticker: "SLB", side: "long", thesis: "Global services leader benefits as producers reinvest at higher prices." },
      { ticker: "DAL", side: "avoid", thesis: "Jet fuel is a large cost line; margins compress on sustained crude spikes." },
    ],
  },
  "evt-002": {
    regions: ["US"],
    topPicks: [
      { ticker: "JPM", side: "long", thesis: "Higher-for-longer supports net interest margin at scale." },
      { ticker: "MET", side: "long", thesis: "Insurance float reinvests at higher yields." },
      { ticker: "O", side: "avoid", thesis: "REIT valuations remain pressured by elevated discount rates." },
    ],
  },
  "evt-003": {
    regions: ["EU"],
    topPicks: [
      { ticker: "CRWD", side: "long", thesis: "New AI audit / safety requirements expand cyber and compliance TAM." },
      { ticker: "PANW", side: "long", thesis: "Enterprise governance tailwinds for platform vendors." },
      { ticker: "META", side: "avoid", thesis: "Elevated liability exposure on generative outputs served to EU users." },
    ],
  },
  "evt-004": {
    regions: ["US"],
    topPicks: [
      { ticker: "HD", side: "long", thesis: "Rebuild demand drives lumber, roofing, appliance restocking." },
      { ticker: "GNRC", side: "long", thesis: "Backup power demand spike is historically reliable post-landfall." },
      { ticker: "ALL", side: "avoid", thesis: "Catastrophe losses hit P&C underwriting results near-term." },
    ],
  },
  "evt-005": {
    regions: ["CN", "JP", "US", "GLOBAL"],
    topPicks: [
      { ticker: "LMT", side: "long", thesis: "Allied defense spending rises with sustained Asia-Pacific tension." },
      { ticker: "RTX", side: "long", thesis: "Missile and sensor programs benefit from restocking cycles." },
      { ticker: "NVDA", side: "avoid", thesis: "Supply concentration at TSMC amplifies near-term production risk." },
    ],
  },
  "evt-006": {
    regions: ["US", "GLOBAL"],
    topPicks: [
      { ticker: "NVDA", side: "long", thesis: "Frontier models expand training and inference compute demand." },
      { ticker: "AVGO", side: "long", thesis: "Custom AI silicon and networking benefit from hyperscaler capex." },
      { ticker: "MSFT", side: "long", thesis: "Model utility gains flow through to Azure consumption." },
    ],
  },
  "evt-007": {
    regions: ["CN", "AU", "EU"],
    topPicks: [
      { ticker: "BHP", side: "long", thesis: "Australian miner with direct iron-ore leverage to Chinese construction." },
      { ticker: "RIO", side: "long", thesis: "Iron ore and copper exposure into a China property restart." },
      { ticker: "FCX", side: "long", thesis: "Copper is the cleanest read on Chinese industrial reacceleration." },
    ],
  },
  "evt-008": {
    regions: ["US"],
    topPicks: [
      { ticker: "SPOT", side: "long", thesis: "Reduced platform take-rate would meaningfully improve unit economics." },
      { ticker: "MTCH", side: "long", thesis: "App-store fee relief flows straight to margin." },
      { ticker: "AAPL", side: "avoid", thesis: "Services revenue faces regulatory pressure on high-margin fees." },
    ],
  },
  "evt-009": {
    regions: ["US", "GLOBAL"],
    topPicks: [
      { ticker: "NTR", side: "long", thesis: "Fertilizer demand and pricing firm on higher crop values." },
      { ticker: "DE", side: "long", thesis: "US acreage response supports equipment orders." },
      { ticker: "GIS", side: "avoid", thesis: "Grain and oil input inflation pressures packaged-food margin." },
    ],
  },
  "evt-010": {
    regions: ["EU"],
    topPicks: [
      { ticker: "SAP", side: "long", thesis: "Weaker euro improves competitiveness for European exporters." },
      { ticker: "VNA", side: "long", thesis: "Lower rates ease refinancing for European property owners." },
      { ticker: "DB", side: "avoid", thesis: "Compressed rates weigh on European bank net interest margin." },
    ],
  },
};

// Live (ingested) events register their region + exposure metadata here at
// runtime, so the same helpers work for both curated and live events.
const LIVE_META: Record<string, EventMeta> = {};

export function registerEventMeta(
  entries: Record<string, { regions: RegionCode[]; topPicks: TopPick[] }>,
) {
  for (const [id, meta] of Object.entries(entries)) LIVE_META[id] = meta;
}

export function eventRegions(id: string): RegionCode[] {
  return EVENT_META[id]?.regions ?? LIVE_META[id]?.regions ?? ["GLOBAL"];
}

export function eventTopPicks(id: string): TopPick[] {
  return EVENT_META[id]?.topPicks ?? LIVE_META[id]?.topPicks ?? [];
}

export function eventMatchesRegions(id: string, selected: RegionCode[]): boolean {
  if (selected.length === 0) return true;
  const r = eventRegions(id);
  if (r.includes("GLOBAL")) return true;
  return r.some((x) => selected.includes(x));
}
