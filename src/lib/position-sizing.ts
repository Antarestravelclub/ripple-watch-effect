// Risk-based position sizing for the paper portfolio. Pure and client-safe.
import { convictionBand } from "./conviction";
import { STOP_ATR_MULT } from "./signal-levels";

export interface PortfolioSettings {
  notional_value: number;
  risk_per_trade_pct: number;
  max_position_pct: number;
}

export const DEFAULT_PORTFOLIO: PortfolioSettings = {
  notional_value: 100_000,
  risk_per_trade_pct: 0.5,
  max_position_pct: 5,
};

/** Conviction multiplier: full size at 80+, three-quarters at 65–79, half at 55–64, none below. */
export function convictionScale(score: number | null | undefined): number {
  switch (convictionBand(score)) {
    case "high":
      return 1;
    case "medium":
      return 0.75;
    case "low":
      return 0.5;
    default:
      return 0;
  }
}

/**
 * Position size as a % of portfolio notional, sized so a stop-out costs
 * risk_per_trade_pct of notional, then capped and scaled by conviction.
 */
export function suggestedSizePct(
  entry: number,
  atr: number,
  score: number | null | undefined,
  settings: PortfolioSettings = DEFAULT_PORTFOLIO,
): number {
  const riskPerShare = STOP_ATR_MULT * atr;
  if (!(entry > 0) || !(riskPerShare > 0)) return 0;
  const raw = (settings.risk_per_trade_pct * entry) / riskPerShare;
  const capped = Math.min(raw, settings.max_position_pct);
  return +(capped * convictionScale(score)).toFixed(3);
}

/** Risk in % of entry price between entry and stop — the "1R" denominator. */
export function riskPctOf(entry: number, stop: number): number | null {
  if (!(entry > 0) || !(stop > 0)) return null;
  const r = (Math.abs(entry - stop) / entry) * 100;
  return r > 0 ? r : null;
}
