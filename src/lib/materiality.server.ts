// Server-only materiality (impact) classifier. Every new candidate headline is
// scored before it is allowed to become an event, so feed noise never reaches
// the Today tab. Research framing only — never advice.

import { chatJSON } from "./ai-provider.server";

export const IMPACT_THRESHOLD = 40;
export const RUN_ACCEPT_CAP = 15;

export type ImpactDirection = "risk_on" | "risk_off" | "mixed" | "sector_specific";
export type ImpactCategory =
  | "geopolitics"
  | "macro"
  | "central_bank"
  | "earnings"
  | "commodity"
  | "regulation"
  | "tech"
  | "other";

export interface Materiality {
  impact_score: number;
  impact_direction: ImpactDirection;
  affected_sectors: string[];
  affected_tickers: string[];
  reasoning: string;
  category: ImpactCategory;
}

const RUBRIC = [
  "You score news headlines for how materially they move listed markets.",
  "Return ONLY JSON of this exact shape:",
  '{"impact_score":0-100,"impact_direction":"risk_on|risk_off|mixed|sector_specific","affected_sectors":["..."],"affected_tickers":["..."],"reasoning":"one sentence","category":"geopolitics|macro|central_bank|earnings|commodity|regulation|tech|other"}',
  "Scoring rubric:",
  "80-100: moves whole markets — war or major geopolitical escalation, surprise central bank action, major sovereign default, systemic financial event.",
  "60-79: moves sectors — OPEC decisions, major regulation, large-cap earnings surprise with sector read-through, big commodity supply shocks.",
  "40-59: moves single names — company-specific earnings, M&A, guidance, downgrades on large caps.",
  "0-39: noise — opinion, listicles, personal finance, personality or lifestyle pieces, 'what to watch' previews.",
  "Be strict: most consumer and lifestyle stories are noise. Use real exchange tickers only.",
  "Never give investment advice and never use the words buy, sell or recommendation.",
].join("\n");

function parseLoose(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const s = cleaned.indexOf("{");
    const e = cleaned.lastIndexOf("}");
    if (s >= 0 && e > s) return JSON.parse(cleaned.slice(s, e + 1));
    throw new Error("Model did not return JSON");
  }
}

const DIRECTIONS: ImpactDirection[] = ["risk_on", "risk_off", "mixed", "sector_specific"];
const CATEGORIES: ImpactCategory[] = [
  "geopolitics","macro","central_bank","earnings","commodity","regulation","tech","other",
];

export function normalizeMateriality(raw: unknown): Materiality {
  const o = (raw ?? {}) as Record<string, unknown>;
  const score = Math.max(0, Math.min(100, Math.round(Number(o.impact_score ?? 0) || 0)));
  const dir = String(o.impact_direction ?? "").toLowerCase() as ImpactDirection;
  const cat = String(o.category ?? "").toLowerCase() as ImpactCategory;
  const list = (v: unknown) =>
    (Array.isArray(v) ? v : []).map((x) => String(x).trim()).filter(Boolean).slice(0, 12);
  return {
    impact_score: score,
    impact_direction: DIRECTIONS.includes(dir) ? dir : "mixed",
    affected_sectors: list(o.affected_sectors),
    affected_tickers: list(o.affected_tickers).map((t) => t.toUpperCase()),
    reasoning: String(o.reasoning ?? "").trim().slice(0, 400),
    category: CATEGORIES.includes(cat) ? cat : "other",
  };
}

export async function scoreMateriality(text: string): Promise<Materiality> {
  const content = await chatJSON(RUBRIC, `Score this headline and summary:\n\n${text}`);
  return normalizeMateriality(parseLoose(content));
}

/** Map the classifier's category onto the app's stored event categories. */
export function eventCategoryFor(category: ImpactCategory): string {
  switch (category) {
    case "central_bank":
    case "macro":
      return "Central Bank";
    case "commodity":
      return "Commodity";
    case "regulation":
      return "Regulation";
    case "tech":
      return "Tech";
    default:
      return "Geopolitical";
  }
}
