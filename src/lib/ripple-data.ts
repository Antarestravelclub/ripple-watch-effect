// Mock data layer for The Ripple Effect.
// Shape is intentionally stable so a real news + market data API can replace it later.

export type EventCategory =
  | "Geopolitical"
  | "Central Bank"
  | "Commodity"
  | "Regulation"
  | "Tech"
  | "Weather/Disaster";

export type RippleStrength = "Low" | "Medium" | "High";

export interface ExposureSector {
  sector: string; // GICS sector or industry
  tickers: string[];
  mechanism: string;
}

export interface HistoricalEcho {
  date: string; // e.g. "Feb 2022"
  event: string;
  outcomes: {
    sector: string;
    d1: number; // % move
    d5: number;
    d30: number;
  }[];
}

export interface RippleEvent {
  id: string;
  headline: string;
  category: EventCategory;
  publishedAt: string; // ISO
  source: string;
  whyMarketsCare: string;
  strength: RippleStrength;
  tailwinds: ExposureSector[];
  headwinds: ExposureSector[];
  historicalEchoes: HistoricalEcho[];
}

// The 11 GICS sectors
export const GICS_SECTORS = [
  "Energy",
  "Materials",
  "Industrials",
  "Consumer Discretionary",
  "Consumer Staples",
  "Health Care",
  "Financials",
  "Information Technology",
  "Communication Services",
  "Utilities",
  "Real Estate",
] as const;

export const EVENTS: RippleEvent[] = [
  {
    id: "evt-001",
    headline: "OPEC+ announces surprise 1M bpd production cut",
    category: "Commodity",
    publishedAt: "2026-07-26T07:15:00Z",
    source: "Reuters",
    whyMarketsCare:
      "Tighter crude supply lifts oil prices, redistributing margin across the energy value chain.",
    strength: "High",
    tailwinds: [
      {
        sector: "Energy — Upstream",
        tickers: ["XOM", "CVX", "COP", "OXY"],
        mechanism: "Higher realized crude prices lift upstream revenue per barrel.",
      },
      {
        sector: "Energy Services",
        tickers: ["SLB", "HAL"],
        mechanism: "Rising prices incentivize drilling activity and service contracts.",
      },
    ],
    headwinds: [
      {
        sector: "Airlines",
        tickers: ["DAL", "UAL", "AAL"],
        mechanism: "Jet fuel is 20-30% of operating cost; margins compress on price spikes.",
      },
      {
        sector: "Refiners",
        tickers: ["MPC", "VLO", "PSX"],
        mechanism: "Feedstock costs rise faster than product prices in the short run.",
      },
      {
        sector: "Consumer Discretionary",
        tickers: ["AMZN", "TGT"],
        mechanism: "Higher gasoline prices squeeze discretionary spending budgets.",
      },
    ],
    historicalEchoes: [
      {
        date: "Oct 2022",
        event: "OPEC+ 2M bpd cut announcement",
        outcomes: [
          { sector: "Energy", d1: 1.8, d5: 3.2, d30: 6.4 },
          { sector: "Airlines", d1: -2.1, d5: -3.8, d30: -5.5 },
        ],
      },
      {
        date: "Apr 2023",
        event: "Voluntary 1.6M bpd OPEC+ cut",
        outcomes: [
          { sector: "Energy", d1: 4.3, d5: 2.1, d30: -1.2 },
          { sector: "Airlines", d1: -3.2, d5: -1.4, d30: 2.8 },
        ],
      },
    ],
  },
  {
    id: "evt-002",
    headline: "Federal Reserve holds rates, signals patient stance on cuts",
    category: "Central Bank",
    publishedAt: "2026-07-26T18:00:00Z",
    source: "FOMC Release",
    whyMarketsCare:
      "Rate path expectations reprice duration-sensitive equities and rate-linked financials.",
    strength: "High",
    tailwinds: [
      {
        sector: "Banks",
        tickers: ["JPM", "BAC", "WFC"],
        mechanism: "Higher-for-longer rates support net interest margin.",
      },
      {
        sector: "Insurance",
        tickers: ["MET", "PRU"],
        mechanism: "Investment portfolios earn more yield on floats.",
      },
    ],
    headwinds: [
      {
        sector: "Real Estate (REITs)",
        tickers: ["O", "SPG", "PLD"],
        mechanism: "Higher discount rates pressure valuations and refinancing costs.",
      },
      {
        sector: "Long-duration Tech",
        tickers: ["ARKK", "PLTR", "SNOW"],
        mechanism: "Distant cash flows are discounted more heavily.",
      },
      {
        sector: "Homebuilders",
        tickers: ["DHI", "LEN"],
        mechanism: "Mortgage rates stay elevated, cooling new-home demand.",
      },
    ],
    historicalEchoes: [
      {
        date: "Sep 2023",
        event: "Fed hawkish pause",
        outcomes: [
          { sector: "Banks", d1: 0.8, d5: 1.4, d30: -2.1 },
          { sector: "REITs", d1: -1.9, d5: -3.6, d30: -5.8 },
        ],
      },
    ],
  },
  {
    id: "evt-003",
    headline: "EU passes sweeping AI liability directive",
    category: "Regulation",
    publishedAt: "2026-07-25T14:30:00Z",
    source: "European Commission",
    whyMarketsCare:
      "New compliance costs and legal exposure reshape competitive positioning across AI supply chain.",
    strength: "Medium",
    tailwinds: [
      {
        sector: "Cybersecurity & Compliance",
        tickers: ["CRWD", "PANW", "ZS"],
        mechanism: "New audit and safety requirements expand addressable market.",
      },
      {
        sector: "Legal Tech",
        tickers: ["RELX"],
        mechanism: "Rising demand for compliance tooling and legal review services.",
      },
    ],
    headwinds: [
      {
        sector: "Consumer AI Platforms",
        tickers: ["META", "GOOGL"],
        mechanism: "Elevated liability risk on generative outputs distributed to EU users.",
      },
      {
        sector: "AI Chipmakers",
        tickers: ["NVDA", "AMD"],
        mechanism: "Slower enterprise deployment cycles as customers redo governance.",
      },
    ],
    historicalEchoes: [
      {
        date: "May 2018",
        event: "GDPR enforcement begins",
        outcomes: [
          { sector: "Cybersecurity", d1: 0.6, d5: 1.8, d30: 4.2 },
          { sector: "Ad Tech", d1: -1.4, d5: -2.9, d30: -6.1 },
        ],
      },
    ],
  },
  {
    id: "evt-004",
    headline: "Category 4 hurricane makes landfall on US Gulf Coast",
    category: "Weather/Disaster",
    publishedAt: "2026-07-25T22:00:00Z",
    source: "NOAA",
    whyMarketsCare:
      "Refinery outages, insured losses, and rebuild spend reshape near-term sector cash flows.",
    strength: "High",
    tailwinds: [
      {
        sector: "Home Improvement",
        tickers: ["HD", "LOW"],
        mechanism: "Rebuild demand accelerates lumber, roofing, and appliance sales.",
      },
      {
        sector: "Building Materials",
        tickers: ["EXP", "VMC"],
        mechanism: "Reconstruction lifts aggregates and cement volume.",
      },
      {
        sector: "Generators & Utilities Equipment",
        tickers: ["GNRC"],
        mechanism: "Backup power demand spikes post-storm.",
      },
    ],
    headwinds: [
      {
        sector: "P&C Insurance",
        tickers: ["ALL", "TRV", "PGR"],
        mechanism: "Catastrophe losses hit underwriting results.",
      },
      {
        sector: "Regional Airlines & Cruise",
        tickers: ["ALK", "CCL"],
        mechanism: "Cancellations and route disruptions weigh on revenue.",
      },
      {
        sector: "Gulf Coast Refiners",
        tickers: ["VLO", "MPC"],
        mechanism: "Refinery downtime removes throughput and margin.",
      },
    ],
    historicalEchoes: [
      {
        date: "Aug 2017",
        event: "Hurricane Harvey",
        outcomes: [
          { sector: "Home Improvement", d1: 1.2, d5: 3.4, d30: 5.8 },
          { sector: "P&C Insurance", d1: -2.6, d5: -1.9, d30: 1.4 },
        ],
      },
      {
        date: "Sep 2022",
        event: "Hurricane Ian",
        outcomes: [
          { sector: "Home Improvement", d1: 0.9, d5: 2.1, d30: 3.6 },
          { sector: "P&C Insurance", d1: -3.4, d5: -4.2, d30: -1.8 },
        ],
      },
    ],
  },
  {
    id: "evt-005",
    headline: "Taiwan Strait tensions escalate after naval drills",
    category: "Geopolitical",
    publishedAt: "2026-07-25T05:45:00Z",
    source: "AP",
    whyMarketsCare:
      "Supply chain risk for advanced semiconductors ripples across global tech and defense.",
    strength: "High",
    tailwinds: [
      {
        sector: "Defense",
        tickers: ["LMT", "RTX", "NOC", "GD"],
        mechanism: "Elevated geopolitical risk drives allied defense budgets.",
      },
      {
        sector: "Onshore Semis",
        tickers: ["INTC", "GFS"],
        mechanism: "Reshoring rhetoric strengthens US-based fab economics.",
      },
    ],
    headwinds: [
      {
        sector: "Global Semis exposed to TSMC",
        tickers: ["NVDA", "AMD", "AAPL"],
        mechanism: "Concentration risk in Taiwan foundry capacity.",
      },
      {
        sector: "Autos",
        tickers: ["F", "GM"],
        mechanism: "Auto chip supply chain remains Taiwan-dependent.",
      },
    ],
    historicalEchoes: [
      {
        date: "Aug 2022",
        event: "Pelosi Taiwan visit",
        outcomes: [
          { sector: "Defense", d1: 1.1, d5: 2.3, d30: 4.6 },
          { sector: "Semis", d1: -2.4, d5: -4.1, d30: -6.8 },
        ],
      },
    ],
  },
  {
    id: "evt-006",
    headline: "Major cloud provider unveils frontier reasoning model",
    category: "Tech",
    publishedAt: "2026-07-25T16:20:00Z",
    source: "Bloomberg",
    whyMarketsCare:
      "Compute demand and platform economics shift as new capabilities lift enterprise adoption.",
    strength: "Medium",
    tailwinds: [
      {
        sector: "AI Infrastructure",
        tickers: ["NVDA", "AVGO", "SMCI"],
        mechanism: "Higher inference and training compute demand.",
      },
      {
        sector: "Hyperscalers",
        tickers: ["MSFT", "GOOGL", "AMZN"],
        mechanism: "Improved model utility increases cloud consumption.",
      },
    ],
    headwinds: [
      {
        sector: "BPO / Call Centers",
        tickers: ["TTEC", "GLOB"],
        mechanism: "Automation pressure on human-in-the-loop workflows.",
      },
      {
        sector: "Legacy SaaS",
        tickers: ["CRM"],
        mechanism: "AI-native competitors compress workflow moats.",
      },
    ],
    historicalEchoes: [
      {
        date: "Mar 2023",
        event: "GPT-4 launch",
        outcomes: [
          { sector: "AI Infrastructure", d1: 2.6, d5: 5.9, d30: 12.1 },
          { sector: "Legacy SaaS", d1: -0.3, d5: -1.1, d30: -2.4 },
        ],
      },
    ],
  },
  {
    id: "evt-007",
    headline: "China announces stimulus package targeting property sector",
    category: "Geopolitical",
    publishedAt: "2026-07-24T09:00:00Z",
    source: "Xinhua",
    whyMarketsCare:
      "Chinese demand impulse flows through global commodities and luxury exporters.",
    strength: "Medium",
    tailwinds: [
      {
        sector: "Industrial Metals",
        tickers: ["FCX", "RIO", "BHP"],
        mechanism: "Construction restart lifts copper and iron ore demand.",
      },
      {
        sector: "European Luxury",
        tickers: ["LVMH"],
        mechanism: "Chinese consumer wealth effect supports luxury spend.",
      },
    ],
    headwinds: [
      {
        sector: "USD-sensitive Exporters",
        tickers: ["PG"],
        mechanism: "Yuan strength / dollar weakness dynamics shift competitiveness.",
      },
    ],
    historicalEchoes: [
      {
        date: "Nov 2022",
        event: "China property support 16-point plan",
        outcomes: [
          { sector: "Industrial Metals", d1: 3.1, d5: 4.8, d30: 7.2 },
        ],
      },
    ],
  },
  {
    id: "evt-008",
    headline: "FTC opens antitrust probe into leading app store",
    category: "Regulation",
    publishedAt: "2026-07-24T13:10:00Z",
    source: "FTC",
    whyMarketsCare:
      "Platform take-rate risk reshapes profit pools between platforms and developers.",
    strength: "Low",
    tailwinds: [
      {
        sector: "App Developers",
        tickers: ["SPOT", "MTCH"],
        mechanism: "Potential reduction in platform fees improves unit economics.",
      },
    ],
    headwinds: [
      {
        sector: "Platform Owners",
        tickers: ["AAPL", "GOOGL"],
        mechanism: "Regulatory pressure on high-margin services revenue.",
      },
    ],
    historicalEchoes: [
      {
        date: "2021",
        event: "Epic vs Apple ruling",
        outcomes: [
          { sector: "Platforms", d1: -3.3, d5: -2.1, d30: 1.4 },
        ],
      },
    ],
  },
  {
    id: "evt-009",
    headline: "Historic drought slashes South American soybean forecast",
    category: "Weather/Disaster",
    publishedAt: "2026-07-24T20:00:00Z",
    source: "USDA",
    whyMarketsCare:
      "Tighter global grain supply raises input costs across food and biofuel value chains.",
    strength: "Medium",
    tailwinds: [
      {
        sector: "Ag Inputs",
        tickers: ["MOS", "CF", "NTR"],
        mechanism: "Higher crop prices support fertilizer demand and pricing.",
      },
      {
        sector: "US Farm Equipment",
        tickers: ["DE", "AGCO"],
        mechanism: "US acreage response boosts equipment demand.",
      },
    ],
    headwinds: [
      {
        sector: "Packaged Food",
        tickers: ["GIS", "K", "KHC"],
        mechanism: "Grain and oil input inflation pressures gross margin.",
      },
      {
        sector: "Protein Producers",
        tickers: ["TSN"],
        mechanism: "Feed costs rise across poultry and pork operations.",
      },
    ],
    historicalEchoes: [
      {
        date: "2012",
        event: "US Midwest drought",
        outcomes: [
          { sector: "Ag Inputs", d1: 1.4, d5: 3.6, d30: 6.9 },
          { sector: "Packaged Food", d1: -0.8, d5: -1.9, d30: -3.4 },
        ],
      },
    ],
  },
  {
    id: "evt-010",
    headline: "ECB cuts deposit rate by 25 bps citing disinflation",
    category: "Central Bank",
    publishedAt: "2026-07-23T12:45:00Z",
    source: "ECB",
    whyMarketsCare:
      "Divergent policy paths reshape currency, sovereign spreads, and European equity leadership.",
    strength: "Medium",
    tailwinds: [
      {
        sector: "European Exporters",
        tickers: ["EWG", "SAP"],
        mechanism: "Weaker euro improves competitiveness for exporters.",
      },
      {
        sector: "European Real Estate",
        tickers: ["VNA"],
        mechanism: "Lower rates ease financing costs for property owners.",
      },
    ],
    headwinds: [
      {
        sector: "European Banks",
        tickers: ["DB", "BNP"],
        mechanism: "Compressed rates weigh on net interest margins.",
      },
    ],
    historicalEchoes: [
      {
        date: "Jun 2024",
        event: "ECB kicks off cutting cycle",
        outcomes: [
          { sector: "EU Exporters", d1: 0.6, d5: 1.8, d30: 3.2 },
        ],
      },
    ],
  },
];

// Map exposure sectors to GICS buckets for the heat panel (rough mapping)
const SECTOR_KEYWORDS: Record<string, (typeof GICS_SECTORS)[number]> = {
  energy: "Energy",
  refiner: "Energy",
  oil: "Energy",
  bank: "Financials",
  insurance: "Financials",
  reit: "Real Estate",
  "real estate": "Real Estate",
  homebuilder: "Consumer Discretionary",
  airline: "Industrials",
  cruise: "Consumer Discretionary",
  defense: "Industrials",
  building: "Materials",
  material: "Materials",
  metal: "Materials",
  ag: "Materials",
  fertilizer: "Materials",
  farm: "Industrials",
  cyber: "Information Technology",
  ai: "Information Technology",
  semi: "Information Technology",
  chip: "Information Technology",
  saas: "Information Technology",
  cloud: "Information Technology",
  tech: "Information Technology",
  platform: "Communication Services",
  luxury: "Consumer Discretionary",
  consumer: "Consumer Discretionary",
  food: "Consumer Staples",
  protein: "Consumer Staples",
  packaged: "Consumer Staples",
  home: "Consumer Discretionary",
  utilities: "Utilities",
  generator: "Industrials",
  auto: "Consumer Discretionary",
  legal: "Industrials",
  bpo: "Industrials",
  exporter: "Industrials",
  ad: "Communication Services",
  media: "Communication Services",
  app: "Communication Services",
};

export function classifyGics(sectorLabel: string): (typeof GICS_SECTORS)[number] | null {
  const lower = sectorLabel.toLowerCase();
  for (const key of Object.keys(SECTOR_KEYWORDS)) {
    if (lower.includes(key)) return SECTOR_KEYWORDS[key];
  }
  return null;
}

export function sectorHeat(events: RippleEvent[]): Record<string, number> {
  const heat: Record<string, number> = {};
  for (const s of GICS_SECTORS) heat[s] = 0;
  for (const e of events) {
    const touched = new Set<string>();
    for (const grp of [...e.tailwinds, ...e.headwinds]) {
      const g = classifyGics(grp.sector);
      if (g) touched.add(g);
    }
    for (const g of touched) heat[g] += 1;
  }
  return heat;
}

export function eventTouchesTicker(evt: RippleEvent, ticker: string): boolean {
  const t = ticker.toUpperCase();
  return [...evt.tailwinds, ...evt.headwinds].some((g) =>
    g.tickers.map((x) => x.toUpperCase()).includes(t),
  );
}

export interface SectorPressure {
  sector: (typeof GICS_SECTORS)[number];
  tailwind: number; // count of tailwind ticker signals
  headwind: number; // count of headwind ticker signals
  net: number;
}

// Net directional pressure per GICS sector: tailwind ticker signals minus headwind ticker signals.
export function sectorPressure(events: RippleEvent[]): SectorPressure[] {
  const map = new Map<string, { tailwind: number; headwind: number }>();
  for (const s of GICS_SECTORS) map.set(s, { tailwind: 0, headwind: 0 });
  for (const e of events) {
    for (const grp of e.tailwinds) {
      const g = classifyGics(grp.sector);
      if (g) map.get(g)!.tailwind += grp.tickers.length;
    }
    for (const grp of e.headwinds) {
      const g = classifyGics(grp.sector);
      if (g) map.get(g)!.headwind += grp.tickers.length;
    }
  }
  return GICS_SECTORS.map((s) => {
    const v = map.get(s)!;
    return { sector: s, tailwind: v.tailwind, headwind: v.headwind, net: v.tailwind - v.headwind };
  });
}
