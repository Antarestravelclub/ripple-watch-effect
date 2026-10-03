import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { dailyBars } from "./daily-bars.server";

export type Verdict = "Buy" | "Hold" | "Sell";

export interface Factor {
  label: string;
  value: string;
  score: number | null; // 0-100
  note: string;
}

export interface Pillar {
  key: "price" | "past" | "profit" | "outlook";
  title: string;
  score: number | null;
  factors: Factor[];
}

export interface Evaluation {
  symbol: string;
  name: string | null;
  price: number | null;
  verdict: Verdict | null;
  score: number | null;
  confidence: "High" | "Medium" | "Low";
  pillars: Pillar[];
  risks: string[];
  closes: number[];
  generatedAt: string;
}

const clamp = (v: number) => Math.max(0, Math.min(100, v));
const lerp = (v: number, lo: number, hi: number) => clamp(((v - lo) / (hi - lo)) * 100);
const pct = (v: number | null | undefined, d = 1) =>
  v == null || !isFinite(v) ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(d)}%`;
const num = (v: unknown): number | null =>
  typeof v === "number" && isFinite(v) ? v : null;

function avg(xs: (number | null)[]): number | null {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

async function finnhub<T>(path: string, key: string): Promise<T | null> {
  try {
    const r = await fetch(`https://finnhub.io/api/v1${path}&token=${key}`);
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

export async function evaluateSymbol(symbol: string): Promise<Evaluation> {
    
    const key = process.env.FINNHUB_API_KEY ?? "";
    const [bars, metricRes, recRes, profile] = await Promise.all([
      dailyBars(symbol, "1y"),
      key
        ? finnhub<{ metric?: Record<string, unknown> }>(`/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all`, key)
        : null,
      key
        ? finnhub<Array<{ strongBuy: number; buy: number; hold: number; sell: number; strongSell: number }>>(
            `/stock/recommendation?symbol=${encodeURIComponent(symbol)}`,
            key,
          )
        : null,
      key ? finnhub<{ name?: string }>(`/stock/profile2?symbol=${encodeURIComponent(symbol)}`, key) : null,
    ]);
    const m = metricRes?.metric ?? {};
    const closes = bars.map((b) => b.close);
    const price = closes.length ? closes[closes.length - 1]! : null;
    const back = (n: number) =>
      closes.length > n && price ? ((price - closes[closes.length - 1 - n]!) / closes[closes.length - 1 - n]!) * 100 : null;
    const sma = (n: number) => (closes.length >= n ? avg(closes.slice(-n)) : null);

    // ---- Current price / valuation
    const hi52 = num(m["52WeekHigh"]) ?? (closes.length ? Math.max(...closes) : null);
    const lo52 = num(m["52WeekLow"]) ?? (closes.length ? Math.min(...closes) : null);
    const range = price != null && hi52 != null && lo52 != null && hi52 > lo52 ? ((price - lo52) / (hi52 - lo52)) * 100 : null;
    const pe = num(m["peTTM"]) ?? num(m["peBasicExclExtraTTM"]);
    const peg = pe != null && num(m["epsGrowthTTMYoy"]) ? pe / Math.max(1, num(m["epsGrowthTTMYoy"])!) : null;
    const priceFactors: Factor[] = [
      {
        label: "Position in 52-week range",
        value: range == null ? "—" : `${range.toFixed(0)}% of range`,
        score: range == null ? null : clamp(100 - Math.abs(range - 55) * 1.4),
        note: "Mid-range is healthiest; at the very top looks stretched, at the bottom may be broken.",
      },
      {
        label: "P/E (trailing)",
        value: pe == null ? "—" : pe.toFixed(1),
        score: pe == null ? null : pe <= 0 ? 15 : clamp(100 - lerp(pe, 10, 50)),
        note: "Lower is cheaper. Negative means the company is losing money.",
      },
      {
        label: "P/E vs earnings growth (PEG)",
        value: peg == null ? "—" : peg.toFixed(2),
        score: peg == null || peg <= 0 ? null : clamp(100 - lerp(peg, 0.8, 3)),
        note: "Under 1 is cheap for its growth; above 2.5 is pricey.",
      },
    ];

    // ---- Past prices / momentum
    const r1 = back(21), r3 = back(63), r6 = back(126), r12 = back(closes.length - 1);
    const s50 = sma(50), s200 = sma(200);
    const pastFactors: Factor[] = [
      { label: "1-month return", value: pct(r1), score: r1 == null ? null : lerp(r1, -10, 10), note: "Short-term trend." },
      { label: "3-month return", value: pct(r3), score: r3 == null ? null : lerp(r3, -20, 20), note: "Medium-term trend." },
      { label: "6-month return", value: pct(r6), score: r6 == null ? null : lerp(r6, -25, 30), note: "Longer trend." },
      { label: "1-year return", value: pct(r12), score: r12 == null ? null : lerp(r12, -30, 40), note: "Full-year performance." },
      {
        label: "Trend vs 50 / 200-day average",
        value:
          price == null || s50 == null
            ? "—"
            : `${price > s50 ? "Above" : "Below"} 50d${s200 ? ` · ${price > s200 ? "above" : "below"} 200d` : ""}`,
        score:
          price == null || s50 == null ? null : (price > s50 ? 50 : 0) + (s200 == null ? 25 : price > s200 ? 50 : 0),
        note: "Above both averages = uptrend.",
      },
    ];

    // ---- Profitability
    const netM = num(m["netProfitMarginTTM"]);
    const opM = num(m["operatingMarginTTM"]);
    const roe = num(m["roeTTM"]);
    const de = num(m["totalDebt/totalEquityQuarterly"]);
    const profitFactors: Factor[] = [
      { label: "Net profit margin", value: pct(netM), score: netM == null ? null : lerp(netM, -5, 25), note: "Share of revenue kept as profit." },
      { label: "Operating margin", value: pct(opM), score: opM == null ? null : lerp(opM, 0, 30), note: "Profit from the core business." },
      { label: "Return on equity", value: pct(roe), score: roe == null ? null : lerp(roe, 0, 30), note: "How well it uses shareholders' money." },
      {
        label: "Debt to equity",
        value: de == null ? "—" : de.toFixed(2),
        score: de == null ? null : clamp(100 - lerp(de, 0.3, 2.5)),
        note: "Lower means less borrowing risk.",
      },
    ];

    // ---- Future outlook
    const rev = num(m["revenueGrowthTTMYoy"]);
    const eps = num(m["epsGrowthTTMYoy"]);
    const rec = recRes?.[0];
    const recTotal = rec ? rec.strongBuy + rec.buy + rec.hold + rec.sell + rec.strongSell : 0;
    const recScore =
      rec && recTotal > 0
        ? ((rec.strongBuy * 100 + rec.buy * 75 + rec.hold * 50 + rec.sell * 25) / recTotal)
        : null;
    const outlookFactors: Factor[] = [
      { label: "Revenue growth (yr/yr)", value: pct(rev), score: rev == null ? null : lerp(rev, -5, 25), note: "Is the business getting bigger?" },
      { label: "Earnings growth (yr/yr)", value: pct(eps), score: eps == null ? null : lerp(eps, -10, 30), note: "Is profit growing?" },
      {
        label: "Analyst consensus",
        value: rec && recTotal ? `${rec.strongBuy + rec.buy} buy · ${rec.hold} hold · ${rec.sell + rec.strongSell} sell` : "—",
        score: recScore,
        note: "Latest monthly analyst ratings.",
      },
    ];

    const mk = (key: Pillar["key"], title: string, factors: Factor[]): Pillar => ({
      key, title, factors, score: avg(factors.map((f) => f.score)),
    });
    const pillars = [
      mk("price", "Current price & valuation", priceFactors),
      mk("past", "Past prices & momentum", pastFactors),
      mk("profit", "Profitability", profitFactors),
      mk("outlook", "Future outlook", outlookFactors),
    ];
    const W = { price: 0.2, past: 0.25, profit: 0.3, outlook: 0.25 };
    let tw = 0, ts = 0;
    for (const p of pillars) if (p.score != null) { tw += W[p.key]; ts += p.score * W[p.key]; }
    const score = tw > 0 ? ts / tw : null;
    const filled = pillars.flatMap((p) => p.factors).filter((f) => f.score != null).length;
    const confidence = filled >= 12 ? "High" : filled >= 7 ? "Medium" : "Low";
    const verdict: Verdict | null = score == null ? null : score >= 65 ? "Buy" : score <= 40 ? "Sell" : "Hold";

    // ---- Risk flags
    const risks: string[] = [];
    if (closes.length > 20) {
      const rets = closes.slice(1).map((c, i) => Math.log(c / closes[i]!));
      const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
      const vol = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length) * Math.sqrt(252) * 100;
      let peak = closes[0]!, dd = 0;
      for (const c of closes) { peak = Math.max(peak, c); dd = Math.min(dd, (c - peak) / peak); }
      risks.push(`Annualised volatility ${vol.toFixed(0)}%${vol > 45 ? " — very volatile" : vol > 30 ? " — above average" : ""}.`);
      risks.push(`Worst drop from a peak in the last year: ${(dd * 100).toFixed(0)}%.`);
    }
    if (pe != null && pe <= 0) risks.push("Company is currently unprofitable on a trailing basis.");
    if (de != null && de > 2) risks.push("High debt relative to equity.");
    if (range != null && range > 95) risks.push("Trading at its 52-week high — chasing risk.");
    if (confidence === "Low") risks.push("Limited data available (common for ETFs and non-US listings) — treat the verdict cautiously.");

    return {
      symbol, name: profile?.name ?? null, price, verdict, score, confidence, pillars, risks,
      closes: closes.slice(-126), generatedAt: new Date().toISOString(),
    };
  }

const TICKER = z.string().trim().min(1).max(15).regex(/^[A-Za-z0-9.\-^=]+$/);

export const evaluateStock = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ ticker: TICKER }).parse(d))
  .handler(({ data }) => evaluateSymbol(data.ticker.toUpperCase()));

export const RANK_UNIVERSE = [
  "AAPL","MSFT","NVDA","AMZN","GOOGL","META","TSLA","AVGO","JPM","V",
  "XOM","CVX","LLY","UNH","JNJ","PG","KO","WMT","COST","HD",
  "BAC","NFLX","AMD","INTC","CAT","BA","LMT","NEE","PFE","DIS",
];

export interface RankedStock { symbol: string; name: string | null; price: number | null; score: number; verdict: Verdict; confidence: Evaluation["confidence"]; reason: string }

let rankCache: { at: number; rows: RankedStock[] } | null = null;
let rankInflight: Promise<RankedStock[]> | null = null;
const RANK_TTL = 6 * 3600_000;

async function buildRankings(): Promise<RankedStock[]> {
  const rows: RankedStock[] = [];
  for (let i = 0; i < RANK_UNIVERSE.length; i += 5) {
    const batch = await Promise.all(
      RANK_UNIVERSE.slice(i, i + 5).map((s) => evaluateSymbol(s).catch(() => null)),
    );
    for (const e of batch) {
      if (!e || e.score == null || !e.verdict) continue;
      const best = [...e.pillars].filter((p) => p.score != null).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      const top = e.verdict === "Sell" ? best[best.length - 1] : best[0];
      rows.push({
        symbol: e.symbol, name: e.name, price: e.price, score: e.score, verdict: e.verdict, confidence: e.confidence,
        reason: top ? `${e.verdict === "Sell" ? "Weakest" : "Strongest"}: ${top.title} (${Math.round(top.score ?? 0)})` : "",
      });
    }
  }
  return rows.sort((a, b) => b.score - a.score);
}

export const getRankings = createServerFn({ method: "GET" }).handler(async () => {
  if (rankCache && Date.now() - rankCache.at < RANK_TTL) return { rows: rankCache.rows, generatedAt: new Date(rankCache.at).toISOString() };
  rankInflight ??= buildRankings().finally(() => { rankInflight = null; });
  const rows = await rankInflight;
  if (rows.length) rankCache = { at: Date.now(), rows };
  return { rows, generatedAt: new Date().toISOString() };
});
