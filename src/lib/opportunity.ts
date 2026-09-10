// Pure, client-safe ranking of an event's tracked signals by modelled upside.
// Paper research only — entry/target/exit come from the stored ATR levels.
import type { SignalRow } from "./signal-metrics";

export interface Opportunity {
  signal: SignalRow;
  entry: number;
  target: number;
  /** Protective exit: ATR stop when present, else the invalidation level. */
  exit: number | null;
  /** Modelled move from entry to target, in percent (always positive). */
  upsidePct: number;
  /** Modelled risk from entry to exit, in percent (positive), null when unknown. */
  riskPct: number | null;
  /** Reward-to-risk ratio, null when no exit level is stored. */
  rr: number | null;
}

/**
 * Top N open signals for an event, ranked by modelled upside to target.
 * Rows without an entry or target price are excluded — nothing is invented.
 */
export function rankOpportunities(signals: SignalRow[], limit = 3): Opportunity[] {
  const out: Opportunity[] = [];
  for (const s of signals) {
    if (s.needs_review) continue;
    if (s.status !== "open") continue;
    const entry = s.signal_price;
    const target = s.target_price;
    if (entry == null || target == null || entry <= 0) continue;
    const exit = s.stop_price ?? s.invalidation_price ?? null;
    const upsidePct = (Math.abs(target - entry) / entry) * 100;
    const riskPct = exit != null ? (Math.abs(entry - exit) / entry) * 100 : null;
    out.push({
      signal: s,
      entry,
      target,
      exit,
      upsidePct: +upsidePct.toFixed(2),
      riskPct: riskPct != null ? +riskPct.toFixed(2) : null,
      rr: riskPct && riskPct > 0 ? +(upsidePct / riskPct).toFixed(2) : null,
    });
  }
  // Best modelled upside first; conviction breaks ties.
  out.sort(
    (a, b) =>
      b.upsidePct - a.upsidePct ||
      (b.signal.conviction_score ?? b.signal.conviction ?? 0) -
        (a.signal.conviction_score ?? a.signal.conviction ?? 0),
  );
  // One row per ticker.
  const seen = new Set<string>();
  const unique = out.filter((o) =>
    seen.has(o.signal.ticker) ? false : (seen.add(o.signal.ticker), true),
  );
  return unique.slice(0, limit);
}

export function fmtPrice(n: number): string {
  return n >= 100 ? n.toFixed(2) : n >= 1 ? n.toFixed(2) : n.toFixed(4);
}
