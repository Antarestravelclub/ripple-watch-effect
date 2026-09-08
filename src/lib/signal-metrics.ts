// Pure, client-safe helpers to compute tracked-signal metrics from snapshots.
// No secrets, no server-only imports — safe to import from React components.
import type { ConvictionBreakdown } from "./conviction";

/** Machine-checkable kill conditions attached to a signal. */
export interface InvalidationParams {
  max_days_open?: number;
  close_beyond?: number;
  direction?: "above" | "below";
  event_reversed?: boolean;
}

/** Every state a tracked signal can be in. */
export type SignalStatus = "open" | "closed" | "stopped" | "invalidated";

export interface SignalRow {
  id: string;
  event_id: string;
  ticker: string;
  company_name?: string | null;
  direction: "long" | "short";
  conviction: number;
  rationale: string | null;
  signal_price: number | null;
  signal_timestamp: string;
  status: SignalStatus;
  target_price: number | null;
  invalidation_price: number | null;
  closed_price: number | null;
  closed_at: string | null;
  close_reason: string | null;
  generated_by: string;
  price_status?: string | null;
  price_error?: string | null;
  needs_review?: boolean | null;
  quote_symbol?: string | null;
  // Advisor-grade fields (null on legacy rows).
  conviction_score?: number | null;
  conviction_breakdown?: ConvictionBreakdown | null;
  suggested_size_pct?: number | null;
  atr_at_signal?: number | null;
  stop_price?: number | null;
  invalidation_text?: string | null;
  invalidation_params?: InvalidationParams | null;
  benchmark_symbol?: string | null;
  benchmark_entry_price?: number | null;
  benchmark_entry_estimated?: boolean | null;
  benchmark_exit_price?: number | null;
  below_threshold?: boolean | null;
  mode?: string | null;
}

export interface SnapshotRow {
  price: number;
  captured_at: string;
}

/** True when the signal is no longer running. */
export function isResolved(status: SignalStatus): boolean {
  return status !== "open";
}

export const STATUS_LABEL: Record<SignalStatus, string> = {
  open: "Open",
  closed: "Target hit",
  stopped: "Stopped out",
  invalidated: "Invalidated",
};

/** Realised return of a closed signal, in the direction's favour (%). */
export function realisedPct(s: SignalRow): number | null {
  if (s.signal_price == null || s.closed_price == null) return null;
  const raw = ((s.closed_price - s.signal_price) / s.signal_price) * 100;
  return s.direction === "long" ? raw : -raw;
}

/** Benchmark return over the identical holding window (%). */
export function benchmarkPct(s: SignalRow): number | null {
  const a = s.benchmark_entry_price;
  const b = s.benchmark_exit_price;
  if (a == null || b == null || !(a > 0)) return null;
  return ((b - a) / a) * 100;
}

/** Signal return minus benchmark return over the same window (%). */
export function alphaPct(s: SignalRow): number | null {
  const r = realisedPct(s);
  const bm = benchmarkPct(s);
  if (r == null || bm == null) return null;
  return r - bm;
}

/** Result in multiples of the risk taken (1R = entry → stop distance). */
export function rMultiple(s: SignalRow): number | null {
  const r = realisedPct(s);
  if (r == null || s.signal_price == null || s.stop_price == null) return null;
  const riskPct = (Math.abs(s.signal_price - s.stop_price) / s.signal_price) * 100;
  if (!(riskPct > 0)) return null;
  return r / riskPct;
}

/** Paper P/L in dollars for a closed signal, given the portfolio notional. */
export function paperPnl(s: SignalRow, notional: number): number | null {
  const r = realisedPct(s);
  const size = s.suggested_size_pct;
  if (r == null || size == null) return null;
  return (notional * (size / 100) * r) / 100;
}


export interface SignalMetrics {
  currentPrice: number | null;
  currentPct: number | null;
  runningHigh: number | null;
  runningHighAt: string | null;
  runningLow: number | null;
  runningLowAt: string | null;
  mfePct: number | null; // Max favourable excursion (in direction's favour)
  maePct: number | null; // Max adverse excursion
  mfeDollar: number | null;
  maeDollar: number | null;
  touchedTarget: boolean;
  touchedInvalidation: boolean;
  daysOpen: number;
}

export function computeMetrics(
  signal: SignalRow,
  snapshots: SnapshotRow[],
): SignalMetrics {
  const empty: SignalMetrics = {
    currentPrice: null,
    currentPct: null,
    runningHigh: null,
    runningHighAt: null,
    runningLow: null,
    runningLowAt: null,
    mfePct: null,
    maePct: null,
    mfeDollar: null,
    maeDollar: null,
    touchedTarget: false,
    touchedInvalidation: false,
    daysOpen: 0,
  };
  const startMs = new Date(signal.signal_timestamp).getTime();
  const endMs = signal.closed_at
    ? new Date(signal.closed_at).getTime()
    : Date.now();
  empty.daysOpen = Math.max(
    0,
    Math.round((endMs - startMs) / 86_400_000),
  );

  if (!signal.signal_price || snapshots.length === 0) return empty;

  const sp = signal.signal_price;
  let high = snapshots[0].price;
  let highAt = snapshots[0].captured_at;
  let low = snapshots[0].price;
  let lowAt = snapshots[0].captured_at;
  let touchedTarget = false;
  let touchedInv = false;

  for (const s of snapshots) {
    if (s.price > high) {
      high = s.price;
      highAt = s.captured_at;
    }
    if (s.price < low) {
      low = s.price;
      lowAt = s.captured_at;
    }
    if (signal.target_price != null) {
      if (signal.direction === "long" && s.price >= signal.target_price)
        touchedTarget = true;
      if (signal.direction === "short" && s.price <= signal.target_price)
        touchedTarget = true;
    }
    if (signal.invalidation_price != null) {
      if (signal.direction === "long" && s.price <= signal.invalidation_price)
        touchedInv = true;
      if (signal.direction === "short" && s.price >= signal.invalidation_price)
        touchedInv = true;
    }
  }

  const last = snapshots[snapshots.length - 1].price;
  const pct = ((last - sp) / sp) * 100;
  const currentPct = signal.direction === "long" ? pct : -pct;

  const favPrice = signal.direction === "long" ? high : low;
  const advPrice = signal.direction === "long" ? low : high;
  const favMove = signal.direction === "long" ? favPrice - sp : sp - favPrice;
  const advMove = signal.direction === "long" ? advPrice - sp : sp - advPrice;

  return {
    currentPrice: last,
    currentPct,
    runningHigh: high,
    runningHighAt: highAt,
    runningLow: low,
    runningLowAt: lowAt,
    mfePct: (favMove / sp) * 100,
    maePct: (advMove / sp) * 100,
    mfeDollar: favMove,
    maeDollar: advMove,
    touchedTarget,
    touchedInvalidation: touchedInv,
    daysOpen: empty.daysOpen,
  };
}

export function pctTone(pct: number | null): string {
  if (pct == null) return "text-muted-foreground";
  if (pct > 0.1) return "text-tailwind";
  if (pct < -0.1) return "text-headwind";
  return "text-muted-foreground";
}

export function fmtPct(pct: number | null, digits = 2): string {
  if (pct == null || !isFinite(pct)) return "—";
  const s = pct.toFixed(digits);
  return (pct > 0 ? "+" : "") + s + "%";
}

export function fmtPrice(p: number | null): string {
  if (p == null || !isFinite(p)) return "—";
  return "$" + p.toFixed(2);
}
