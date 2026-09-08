// Pure, client-safe target/invalidation level maths.
// Expected move is driven by the event's ripple magnitude.

export type RippleMagnitude = "High" | "Medium" | "Low";

export const EXPECTED_MOVE_PCT: Record<RippleMagnitude, number> = {
  High: 4,
  Medium: 2,
  Low: 1,
};

/** Number of trading days a signal is allowed to run before expiring. */
export const EXPIRY_TRADING_DAYS = 10;

/** ATR multiples used for advisor-grade stops and targets. */
export const STOP_ATR_MULT = 1.5;
export const TARGET_ATR_MULT = 2.0;

/** ATR-scaled stop and target for an entry price (long; mirrored for short). */
export function atrLevels(entry: number, direction: "long" | "short", atr: number) {
  const sign = direction === "long" ? 1 : -1;
  return {
    stop: +(entry - sign * STOP_ATR_MULT * atr).toFixed(4),
    target: +(entry + sign * TARGET_ATR_MULT * atr).toFixed(4),
  };
}


export interface Levels {
  target: number;
  invalidation: number;
  expectedMovePct: number;
}

/**
 * LONG: target above snapshot, invalidation below by half the expected move.
 * SHORT: mirrored.
 */
export function levelsFor(
  snapshot: number,
  direction: "long" | "short",
  magnitude: RippleMagnitude,
): Levels {
  const pct = EXPECTED_MOVE_PCT[magnitude] / 100;
  const half = pct / 2;
  const sign = direction === "long" ? 1 : -1;
  return {
    target: +(snapshot * (1 + sign * pct)).toFixed(4),
    invalidation: +(snapshot * (1 - sign * half)).toFixed(4),
    expectedMovePct: EXPECTED_MOVE_PCT[magnitude],
  };
}

/** Approximate trading days elapsed between two instants (5/7 of calendar days). */
export function tradingDaysBetween(fromISO: string, toMs = Date.now()): number {
  const days = (toMs - new Date(fromISO).getTime()) / 86_400_000;
  return Math.floor((days * 5) / 7);
}
