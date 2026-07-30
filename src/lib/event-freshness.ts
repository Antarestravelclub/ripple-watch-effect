// Event freshness + "priced-in" helpers. Pure and client-safe.
import type { RippleEvent, RippleStrength } from "./ripple-data";
import { EXPECTED_MOVE_PCT } from "./signal-levels";

export const STALE_AFTER_HOURS = 48;

/** Share of the expected move that counts as "already captured". */
export const CAPTURED_THRESHOLD = 0.6;

export function ageHours(iso: string, now = Date.now()): number {
  return (now - new Date(iso).getTime()) / 3_600_000;
}

export function isStale(iso: string, now = Date.now()): boolean {
  return ageHours(iso, now) > STALE_AFTER_HOURS;
}

/** "just now" / "6h ago" under 48h, "3d ago" beyond. */
export function ageLabel(iso: string, now = Date.now()): string {
  const h = ageHours(iso, now);
  if (h < 1) return "just now";
  if (h < STALE_AFTER_HOURS) return `${Math.floor(h)}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const STRENGTH_ORDER: Record<RippleStrength, number> = { High: 0, Medium: 1, Low: 2 };

/** High ripple first, then most recent first. */
export function sortByStrengthThenRecency(events: RippleEvent[]): RippleEvent[] {
  return [...events].sort((a, b) => {
    const s = STRENGTH_ORDER[a.strength] - STRENGTH_ORDER[b.strength];
    if (s !== 0) return s;
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });
}

export function expectedMovePct(strength: RippleStrength): number {
  return EXPECTED_MOVE_PCT[strength];
}

/**
 * Fraction of the expected move already travelled in the signal's favour.
 * Returns null when there is nothing to compare against.
 */
export function capturedRatio(
  movePct: number | null,
  strength: RippleStrength,
): number | null {
  if (movePct == null || !isFinite(movePct)) return null;
  const expected = expectedMovePct(strength);
  if (!expected) return null;
  return movePct / expected;
}

export function isMoveCaptured(
  movePct: number | null,
  strength: RippleStrength,
): boolean {
  const r = capturedRatio(movePct, strength);
  return r != null && r >= CAPTURED_THRESHOLD;
}
