// Rebound scanner: finds the biggest losers over the last 1–3 completed
// sessions and scores how likely each is to snap back toward its normal
// (20-day average) price. Price-history only — no fundamentals — so it is
// fast and doesn't touch the Finnhub rate limit.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { dailyBars, type DailyBar } from "./daily-bars.server";
import {
  RANK_UNIVERSE, XM_UNIVERSE, XM_ETF_UNIVERSE, AU_UNIVERSE, CA_UNIVERSE,
} from "./stock-eval.functions";

export type ReboundUniverse = "major" | "xm" | "xmetf" | "ca" | "au";

export interface ReboundRow {
  symbol: string;
  price: number;
  dropPct: number;          // % change over the lookback window (negative)
  dropAtr: number;          // size of the drop in ATR(14) units
  biggestDayPct: number;    // worst single session in the window
  rsi14: number | null;
  sma20: number | null;     // "normal price" target
  sma200: number | null;
  upsidePct: number | null; // % back to SMA20
  stop: number | null;      // recent low − 0.5 ATR
  rewardRisk: number | null;
  score: number;            // 0–100 rebound likelihood
  grade: "Strong" | "Possible" | "Weak";
  positives: string[];
  warnings: string[];
  closes: number[];         // last ~30 closes for the sparkline
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const clamp = (v: number) => Math.max(0, Math.min(100, v));
const lerp = (v: number, lo: number, hi: number) => clamp(((v - lo) / (hi - lo)) * 100);

function atr14(b: DailyBar[]): number | null {
  if (b.length < 15) return null;
  const trs: number[] = [];
  for (let i = b.length - 14; i < b.length; i++) {
    const prev = b[i - 1]!.close;
    trs.push(Math.max(b[i]!.high - b[i]!.low, Math.abs(b[i]!.high - prev), Math.abs(b[i]!.low - prev)));
  }
  return avg(trs);
}

function rsi14(closes: number[]): number | null {
  if (closes.length < 15) return null;
  let g = 0, l = 0;
  for (let i = closes.length - 14; i < closes.length; i++) {
    const d = closes[i]! - closes[i - 1]!;
    if (d > 0) g += d; else l -= d;
  }
  if (l === 0) return 100;
  return 100 - 100 / (1 + g / l);
}

/** Drop today's still-trading bar so "the day before" means completed sessions. */
function completed(bars: DailyBar[]): DailyBar[] {
  if (!bars.length) return bars;
  const et = (t: number) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(t);
  const now = Date.now();
  const hourET = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false }).format(now));
  const last = bars[bars.length - 1]!;
  if (et(last.time) === et(now) && hourET < 16) return bars.slice(0, -1);
  return bars;
}

function analyse(symbol: string, raw: DailyBar[], days: number): ReboundRow | null {
  const bars = completed(raw);
  if (bars.length < 60) return null;
  const closes = bars.map((b) => b.close);
  const price = closes[closes.length - 1]!;
  const start = closes[closes.length - 1 - days]!;
  const dropPct = ((price - start) / start) * 100;
  if (dropPct >= 0) return null;

  const atrBars = bars.slice(0, bars.length - days); // ATR *before* the drop = what's "normal"
  const atr = atr14(atrBars) ?? atr14(bars);
  if (!atr) return null;
  const dropAtr = (start - price) / atr;

  let biggestDayPct = 0;
  for (let i = closes.length - days; i < closes.length; i++) {
    biggestDayPct = Math.min(biggestDayPct, ((closes[i]! - closes[i - 1]!) / closes[i - 1]!) * 100);
  }

  const sma20 = closes.length >= 20 ? avg(closes.slice(-20)) : null;
  const sma200 = closes.length >= 200 ? avg(closes.slice(-200)) : null;
  const rsi = rsi14(closes);
  const low52 = Math.min(...closes.slice(-252));
  const ret6m = closes.length > 126 ? ((price - closes[closes.length - 127]!) / closes[closes.length - 127]!) * 100 : null;
  const windowLow = Math.min(...bars.slice(-days).map((b) => b.low));
  const stop = windowLow - 0.5 * atr;
  const upsidePct = sma20 != null && sma20 > price ? ((sma20 - price) / price) * 100 : null;
  const rewardRisk = sma20 != null && sma20 > price && price > stop ? (sma20 - price) / (price - stop) : null;

  const positives: string[] = [];
  const warnings: string[] = [];

  // 1) How unusual is the drop? 2–4 ATR is the sweet spot for snap-backs.
  const sStretch = dropAtr < 1 ? lerp(dropAtr, 0, 1) * 0.4 : dropAtr <= 4 ? 70 + lerp(dropAtr, 1, 3) * 0.3 : clamp(100 - (dropAtr - 4) * 15);
  if (dropAtr >= 2) positives.push(`Drop is ${dropAtr.toFixed(1)}× its normal daily range — stretched`);

  // 2) Oversold momentum.
  const sRsi = rsi == null ? 50 : rsi <= 30 ? 100 : clamp(100 - lerp(rsi, 30, 60));
  if (rsi != null && rsi <= 30) positives.push(`RSI ${rsi.toFixed(0)} — oversold`);

  // 3) Healthy long-term trend: dips inside uptrends revert more reliably.
  let sTrend = 50;
  if (sma200 != null) {
    sTrend = price >= sma200 ? 90 : clamp(60 - ((sma200 - price) / sma200) * 300);
    if (price >= sma200) positives.push("Still above its 200-day average — dip in an uptrend");
    else warnings.push("Below its 200-day average — longer-term downtrend");
  }
  if (ret6m != null && ret6m < -25) { sTrend = Math.min(sTrend, 20); warnings.push(`Down ${Math.abs(ret6m).toFixed(0)}% over 6 months`); }

  // 4) Room to get back to normal.
  const sRoom = upsidePct == null ? 0 : clamp(lerp(upsidePct, 0, 8));
  if (rewardRisk != null && rewardRisk >= 1.5) positives.push(`Reward/risk ${rewardRisk.toFixed(1)} back to its 20-day average`);

  let score = 0.3 * sStretch + 0.25 * sRsi + 0.25 * sTrend + 0.2 * sRoom;

  // Falling-knife penalties.
  if (biggestDayPct <= -12) { score -= 20; warnings.push(`Single-day gap of ${biggestDayPct.toFixed(0)}% — likely news/earnings; these often don't revert`); }
  if (price <= low52 * 1.01) { score -= 10; warnings.push("At a new 52-week low"); }
  if (dropAtr > 6) warnings.push("Drop is extreme for this stock — check the news first");

  score = clamp(score);
  const grade: ReboundRow["grade"] = score >= 65 ? "Strong" : score >= 45 ? "Possible" : "Weak";

  return {
    symbol, price, dropPct, dropAtr, biggestDayPct, rsi14: rsi, sma20, sma200, upsidePct,
    stop, rewardRisk, score, grade, positives, warnings, closes: closes.slice(-30),
  };
}

const LISTS: Record<ReboundUniverse, string[]> = {
  major: RANK_UNIVERSE,
  xm: XM_UNIVERSE,
  xmetf: XM_ETF_UNIVERSE,
  ca: CA_UNIVERSE,
  au: AU_UNIVERSE,
};

const cache = new Map<string, { at: number; rows: ReboundRow[]; scanned: number; failed: number }>();
const TTL = 20 * 60_000;

export const getRebounds = createServerFn({ method: "GET" })
  .inputValidator((d) =>
    z.object({
      universe: z.enum(["major", "xm", "xmetf", "ca", "au"]).default("xm"),
      days: z.number().int().min(1).max(3).default(2),
    }).parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    const key = `${data.universe}|${data.days}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL) return { ...hit, generatedAt: new Date(hit.at).toISOString() };

    const list = LISTS[data.universe];
    const rows: ReboundRow[] = [];
    let failed = 0;
    for (let i = 0; i < list.length; i += 8) {
      const batch = await Promise.all(
        list.slice(i, i + 8).map(async (s) => {
          const bars = await dailyBars(s, "1y");
          if (!bars.length) { failed++; return null; }
          return analyse(s, bars, data.days);
        }),
      );
      for (const r of batch) if (r) rows.push(r);
    }
    // Biggest losers first, keep the top 20, then order by rebound score.
    const losers = rows.sort((a, b) => a.dropPct - b.dropPct).slice(0, 20).sort((a, b) => b.score - a.score);
    const entry = { at: Date.now(), rows: losers, scanned: list.length, failed };
    if (failed < list.length / 2) cache.set(key, entry);
    return { ...entry, generatedAt: new Date(entry.at).toISOString() };
  });
