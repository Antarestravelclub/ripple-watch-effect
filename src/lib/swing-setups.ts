// Swing Setups — ranked short-term scenario levels derived from live events.
// Pure and client-safe: no secrets, no server imports, no prediction model.
//
// Everything here is mechanical: levels come from the event's ripple magnitude
// (expected move), the entry band is a tolerance around the live quote, and the
// score is a transparent weighting of freshness, magnitude, confidence,
// remaining move, directional agreement, and data quality.

import type { RippleEvent } from "./ripple-data";
import type { SignalRow } from "./signal-metrics";
import {
  EXPIRY_TRADING_DAYS,
  levelsFor,
  tradingDaysBetween,
  type RippleMagnitude,
} from "./signal-levels";
import { ageHours, CAPTURED_THRESHOLD } from "./event-freshness";
import { isActive } from "./ticker-rollup";
import { tickerMeta } from "./ticker-registry";

export interface SwingSetup {
  signal: SignalRow;
  event: RippleEvent | undefined;
  ticker: string;
  quoteSymbol: string;
  displaySymbol: string;
  companyName: string | null;
  direction: "long" | "short";
  magnitude: RippleMagnitude;
  mechanism: string;
  /** Live (or last-known) price used as the level anchor. */
  currentPrice: number | null;
  /** Entry band around the anchor price. */
  entryLow: number | null;
  entryHigh: number | null;
  target: number | null;
  invalidation: number | null;
  expectedMovePct: number;
  /** Reward divided by risk, from the level geometry. */
  rewardRisk: number;
  movePctSinceSnapshot: number | null;
  capturedRatio: number | null;
  captured: boolean;
  daysOpen: number;
  daysLeft: number;
  conflicted: boolean;
  score: number;
  flags: string[];
}

/** Entry tolerance as a share of the expected move. */
const ENTRY_BAND = 0.2;

function magnitudeOf(event: RippleEvent | undefined, conviction: number): RippleMagnitude {
  if (event) return event.strength;
  return conviction >= 5 ? "High" : conviction >= 3 ? "Medium" : "Low";
}

function scoreOf(input: {
  hours: number | null;
  magnitude: RippleMagnitude;
  conviction: number;
  capturedRatio: number | null;
  conflicted: boolean;
  hasPrice: boolean;
  isUsListing: boolean;
  daysLeft: number;
}): number {
  let score = 0;

  // Freshness — a same-session headline is worth far more than a 3-day-old one.
  if (input.hours != null) {
    if (input.hours <= 6) score += 30;
    else if (input.hours <= 24) score += 24;
    else if (input.hours <= 48) score += 16;
    else if (input.hours <= 96) score += 8;
    else score += 2;
  } else {
    score += 8;
  }

  // Ripple magnitude — the size of the mechanical move the event implies.
  score += input.magnitude === "High" ? 25 : input.magnitude === "Medium" ? 16 : 8;

  // Exposure confidence carried on the signal.
  score += input.conviction >= 5 ? 15 : input.conviction >= 3 ? 9 : 4;

  // Remaining move — penalise names that already travelled the expected move.
  const r = input.capturedRatio;
  if (r == null) score += 10;
  else if (r <= 0) score += 20;
  else if (r < 0.3) score += 16;
  else if (r < CAPTURED_THRESHOLD) score += 9;
  else if (r < 1) score += 3;

  // Time left in the tracked window.
  if (input.daysLeft >= 7) score += 10;
  else if (input.daysLeft >= 4) score += 6;
  else if (input.daysLeft >= 1) score += 2;

  if (input.conflicted) score -= 25;
  if (!input.hasPrice) score -= 20;
  if (!input.isUsListing) score -= 5;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function buildSetups(input: {
  signals: SignalRow[];
  latest: Record<string, { price: number; captured_at: string }>;
  events: Map<string, RippleEvent>;
  quotes: Record<string, { price: number } | undefined>;
  conflicted: Set<string>;
  now?: number;
}): SwingSetup[] {
  const now = input.now ?? Date.now();
  const setups: SwingSetup[] = [];

  for (const signal of input.signals) {
    if (!isActive(signal)) continue;
    const event = input.events.get(signal.event_id);
    const magnitude = magnitudeOf(event, signal.conviction);
    const direction = signal.direction;
    const meta = tickerMeta(signal.ticker);
    if (!meta.tradable) continue;
    const quoteSymbol = signal.quote_symbol || meta.quote || signal.ticker;

    const liveQuote = input.quotes[quoteSymbol.toUpperCase()]?.price ?? null;
    const snapshot = signal.signal_price ?? null;
    const currentPrice = liveQuote ?? input.latest[signal.id]?.price ?? snapshot;

    const levels = currentPrice != null ? levelsFor(currentPrice, direction, magnitude) : null;
    const expectedMovePct = levels?.expectedMovePct ?? 0;
    const band = currentPrice != null ? currentPrice * (expectedMovePct / 100) * ENTRY_BAND : null;

    const rawMove =
      snapshot != null && currentPrice != null && snapshot > 0
        ? ((currentPrice - snapshot) / snapshot) * 100
        : null;
    const movePctSinceSnapshot =
      rawMove == null ? null : direction === "short" ? -rawMove : rawMove;
    const capturedRatio =
      movePctSinceSnapshot != null && expectedMovePct > 0
        ? movePctSinceSnapshot / expectedMovePct
        : null;

    const daysOpen = Math.max(0, tradingDaysBetween(signal.signal_timestamp, now));
    const daysLeft = Math.max(0, EXPIRY_TRADING_DAYS - daysOpen);
    const hours = event ? ageHours(event.publishedAt, now) : ageHours(signal.signal_timestamp, now);
    const conflicted = input.conflicted.has(signal.ticker.toUpperCase());

    const flags: string[] = [];
    if (conflicted) flags.push("Conflicted exposure");
    if (currentPrice == null) flags.push("No price data");
    if (capturedRatio != null && capturedRatio >= CAPTURED_THRESHOLD)
      flags.push("Move likely captured");
    if (meta.listing !== "US") flags.push(`Non-US listing · quoted as ${quoteSymbol}`);
    if (daysLeft === 0) flags.push("Window expired");

    setups.push({
      signal,
      event,
      ticker: signal.ticker,
      quoteSymbol,
      displaySymbol: meta.display || signal.ticker,
      companyName: meta.name ?? null,
      direction,
      magnitude,
      mechanism: signal.rationale || event?.whyMarketsCare || "Mechanical exposure to this event.",
      currentPrice,
      entryLow: currentPrice != null && band != null ? +(currentPrice - band).toFixed(2) : null,
      entryHigh: currentPrice != null && band != null ? +(currentPrice + band).toFixed(2) : null,
      target: levels?.target ?? null,
      invalidation: levels?.invalidation ?? null,
      expectedMovePct,
      rewardRisk: 2,
      movePctSinceSnapshot,
      capturedRatio,
      captured: capturedRatio != null && capturedRatio >= CAPTURED_THRESHOLD,
      daysOpen,
      daysLeft,
      conflicted,
      score: scoreOf({
        hours,
        magnitude,
        conviction: signal.conviction,
        capturedRatio,
        conflicted,
        hasPrice: currentPrice != null,
        isUsListing: meta.listing === "US",
        daysLeft,
      }),
      flags,
    });
  }

  return setups.sort((a, b) => b.score - a.score);
}

/** One setup per ticker — keeps the highest-scoring event mapping. */
export function dedupeByTicker(setups: SwingSetup[]): SwingSetup[] {
  const seen = new Set<string>();
  const out: SwingSetup[] = [];
  for (const s of setups) {
    const key = s.ticker.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

export function scoreTone(score: number): string {
  if (score >= 70) return "bg-tailwind/15 text-tailwind border-tailwind/30";
  if (score >= 50) return "bg-primary/15 text-primary border-primary/30";
  return "bg-muted/40 text-muted-foreground border-border/70";
}

export function scoreLabel(score: number): string {
  if (score >= 70) return "Clean";
  if (score >= 50) return "Workable";
  return "Weak";
}
