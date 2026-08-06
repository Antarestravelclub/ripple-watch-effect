// Maps stored live-event rows into the app's RippleEvent shape.
// Pure and client-safe so both server functions and UI can use it.
import type { EventCategory, RippleEvent, RippleStrength, ExposureSector } from "./ripple-data";
import type { RegionCode, TopPick } from "./ripple-regions";

export interface LiveEventRow {
  id: string;
  headline: string;
  summary: string;
  why_markets_care: string;
  source: string;
  source_url: string | null;
  published_at: string;
  category: string;
  strength: string;
  regions: string[];
  transmission_channel: string;
}

export interface LiveExposureRow {
  id: string;
  live_event_id: string;
  ticker: string;
  company_name: string | null;
  side: string;
  sector: string;
  mechanism: string;
  confidence: string;
  quote_symbol: string | null;
  needs_review: boolean;
}

export interface EventMetaEntry {
  regions: RegionCode[];
  topPicks: TopPick[];
}

const CATEGORIES = new Set<string>([
  "Geopolitical",
  "Central Bank",
  "Commodity",
  "Regulation",
  "Tech",
  "Weather/Disaster",
]);

function groupBySector(rows: LiveExposureRow[]): ExposureSector[] {
  const map = new Map<string, ExposureSector>();
  for (const r of rows) {
    const sector = r.sector?.trim() || "Other";
    const existing = map.get(sector);
    if (existing) {
      if (!existing.tickers.includes(r.ticker)) existing.tickers.push(r.ticker);
    } else {
      map.set(sector, {
        sector,
        tickers: [r.ticker],
        mechanism: r.mechanism || "Mechanical exposure to this event.",
      });
    }
  }
  return [...map.values()];
}

export function mapLiveEvents(
  events: LiveEventRow[],
  exposures: LiveExposureRow[],
): { events: RippleEvent[]; meta: Record<string, EventMetaEntry> } {
  const byEvent = new Map<string, LiveExposureRow[]>();
  for (const e of exposures) {
    const list = byEvent.get(e.live_event_id) ?? [];
    list.push(e);
    byEvent.set(e.live_event_id, list);
  }

  const meta: Record<string, EventMetaEntry> = {};
  const mapped: RippleEvent[] = events.map((row) => {
    const all = (byEvent.get(row.id) ?? []).filter((x) => !x.needs_review);
    const tail = all.filter((x) => x.side === "tailwind");
    const head = all.filter((x) => x.side === "headwind");

    meta[row.id] = {
      regions: (row.regions?.length ? row.regions : ["GLOBAL"]) as RegionCode[],
      topPicks: [...tail, ...head]
        .filter((x) => x.confidence !== "Low")
        .slice(0, 6)
        .map<TopPick>((x) => ({
          ticker: x.ticker,
          thesis: x.mechanism || "Mechanical exposure to this event.",
          side: x.side === "tailwind" ? "long" : "avoid",
        })),
    };

    return {
      id: row.id,
      headline: row.headline,
      category: (CATEGORIES.has(row.category) ? row.category : "Geopolitical") as EventCategory,
      publishedAt: row.published_at,
      source: row.source || "News feed",
      whyMarketsCare:
        row.why_markets_care ||
        row.summary ||
        `Transmission channel: ${row.transmission_channel}`,
      strength: (["Low", "Medium", "High"].includes(row.strength)
        ? row.strength
        : "Medium") as RippleStrength,
      tailwinds: groupBySector(tail),
      headwinds: groupBySector(head),
      historicalEchoes: [],
    };
  });

  return { events: mapped, meta };
}
