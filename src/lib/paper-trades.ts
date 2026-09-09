// Pure, client-safe maths for the Paper Trade Blotter.
// The Blotter is a measurement layer: it never touches signal evaluation and
// never routes an order anywhere. Paper only, by construction.

/** A stored quote older than this is stale — matches the feed diagnostics. */
import type { InstrumentType } from "./instrument";

export const STALE_QUOTE_MS = 20 * 60_000;

export type TradeDirection = "long" | "short";
export type TradeStatus = "open" | "closed";
export type ExitReason = "target_hit" | "stop_hit" | "invalidated" | "manual";
/** Where the trade came from: an event signal, or a free-form manual entry. */
export type TradeSource = "signal" | "manual";

export interface PaperTradeRow {
  id: string;
  /** Null for free-form manual trades that aren't tied to a signal. */
  signal_id: string | null;
  source: TradeSource;
  ticker: string;
  quote_symbol: string | null;
  direction: TradeDirection;
  entry_price: number;
  entry_time: string;
  stop_price: number;
  target_price: number;
  position_size: number;
  status: TradeStatus;
  exit_price: number | null;
  exit_time: string | null;
  exit_reason: ExitReason | null;
  realized_pnl: number | null;
  overrides_used: boolean;
  both_touched: boolean;
  notes: string | null;
  /** Denormalised context for splits, joined from the signal. */
  category: string | null;
  conviction_score: number | null;
  cohort: "atr_v1" | "legacy_pct";
  /** Single stock or exchange-traded fund. */
  instrument_type: InstrumentType;
  tradable: boolean;
  /** Demo-account mirroring (opt-in per trade). */
  mirrored: boolean;
  mirror_ticket: number | null;
  demo_fill_price: number | null;
  demo_close_price: number | null;
  demo_realized_pnl: number | null;
}

/** Signed slippage between the paper level and the demo fill. */
export function slippage(
  direction: TradeDirection,
  paperPrice: number,
  demoPrice: number | null,
  side: "entry" | "exit",
) {
  if (demoPrice == null || !(paperPrice > 0)) return null;
  // Positive = the demo fill was better than the paper assumption.
  const raw = demoPrice - paperPrice;
  const favourable =
    side === "entry" ? (direction === "long" ? -raw : raw) : direction === "long" ? raw : -raw;
  return { dollars: favourable, pct: (favourable / paperPrice) * 100 };
}

export interface MirrorComparison {
  trade: PaperTradeRow;
  entry: { dollars: number; pct: number } | null;
  exit: { dollars: number; pct: number } | null;
  paperPnl: number | null;
  demoPnl: number | null;
}

export function mirrorComparisons(trades: PaperTradeRow[]): MirrorComparison[] {
  return trades
    .filter((t) => t.mirrored)
    .map((t) => ({
      trade: t,
      entry: slippage(t.direction, t.entry_price, t.demo_fill_price, "entry"),
      exit: t.exit_price != null ? slippage(t.direction, t.exit_price, t.demo_close_price, "exit") : null,
      paperPnl: t.realized_pnl,
      demoPnl: t.demo_realized_pnl,
    }));
}

export function averageSlippage(rows: MirrorComparison[], side: "entry" | "exit") {
  const values = rows
    .map((r) => (side === "entry" ? r.entry : r.exit))
    .filter((v): v is { dollars: number; pct: number } => v !== null);
  if (values.length === 0) return null;
  return {
    count: values.length,
    dollars: values.reduce((s, v) => s + v.dollars, 0) / values.length,
    pct: values.reduce((s, v) => s + v.pct, 0) / values.length,
  };
}

export const SOURCE_LABEL: Record<TradeSource, string> = {
  signal: "From signal",
  manual: "Manual",
};


export const EXIT_REASON_LABEL: Record<ExitReason, string> = {
  target_hit: "Target hit",
  stop_hit: "Stop hit",
  invalidated: "Invalidated",
  manual: "Closed manually",
};

/** Signed P&L in dollars for a fill, short-aware. */
export function pnlFor(
  direction: TradeDirection,
  entry: number,
  exit: number,
  size: number,
): number {
  const move = direction === "long" ? exit - entry : entry - exit;
  return +(move * size).toFixed(2);
}

/** Percentage move in the trade's favour. */
export function pnlPct(direction: TradeDirection, entry: number, exit: number): number | null {
  if (!(entry > 0)) return null;
  const move = direction === "long" ? exit - entry : entry - exit;
  return +((move / entry) * 100).toFixed(2);
}

/** 1R = |entry − stop| per unit. */
export function riskPerUnit(entry: number, stop: number): number | null {
  const r = Math.abs(entry - stop);
  return r > 0 ? r : null;
}

/** How many R the move is worth. */
export function rMultipleFor(
  direction: TradeDirection,
  entry: number,
  stop: number,
  exit: number,
): number | null {
  const r = riskPerUnit(entry, stop);
  if (r == null) return null;
  const move = direction === "long" ? exit - entry : entry - exit;
  return +(move / r).toFixed(2);
}

export interface LiveTradeMetrics {
  price: number | null;
  pnl: number | null;
  pct: number | null;
  r: number | null;
  toStopPct: number | null;
  toTargetPct: number | null;
  toStopR: number | null;
  toTargetR: number | null;
}

/** Unrealised view of an open trade against the shared price store. */
export function liveMetrics(t: PaperTradeRow, price: number | null): LiveTradeMetrics {
  if (price == null || !(price > 0)) {
    return {
      price: null,
      pnl: null,
      pct: null,
      r: null,
      toStopPct: null,
      toTargetPct: null,
      toStopR: null,
      toTargetR: null,
    };
  }
  const r = riskPerUnit(t.entry_price, t.stop_price);
  return {
    price,
    pnl: pnlFor(t.direction, t.entry_price, price, t.position_size),
    pct: pnlPct(t.direction, t.entry_price, price),
    r: rMultipleFor(t.direction, t.entry_price, t.stop_price, price),
    toStopPct: +(((t.stop_price - price) / price) * 100).toFixed(2),
    toTargetPct: +(((t.target_price - price) / price) * 100).toFixed(2),
    toStopR: r != null ? +((t.stop_price - price) / r).toFixed(2) : null,
    toTargetR: r != null ? +((t.target_price - price) / r).toFixed(2) : null,
  };
}

export interface BlotterStats {
  count: number;
  totalPnl: number;
  pctOfNotional: number;
  winRate: number | null;
  avgWin: number | null;
  avgLoss: number | null;
  avgWinR: number | null;
  avgLossR: number | null;
  profitFactor: number | null;
  expectancy: number | null;
  expectancyR: number | null;
  maxDrawdown: number;
  avgHoldHours: number | null;
}

export interface EquityPoint {
  time: string;
  equity: number;
}

function closedR(t: PaperTradeRow): number | null {
  if (t.exit_price == null) return null;
  return rMultipleFor(t.direction, t.entry_price, t.stop_price, t.exit_price);
}

/** Headline metrics over closed paper trades. */
export function computeStats(trades: PaperTradeRow[], notional: number): BlotterStats {
  const closed = trades
    .filter((t) => t.status === "closed" && t.realized_pnl != null)
    .sort((a, b) => (a.exit_time ?? "").localeCompare(b.exit_time ?? ""));

  const empty: BlotterStats = {
    count: 0,
    totalPnl: 0,
    pctOfNotional: 0,
    winRate: null,
    avgWin: null,
    avgLoss: null,
    avgWinR: null,
    avgLossR: null,
    profitFactor: null,
    expectancy: null,
    expectancyR: null,
    maxDrawdown: 0,
    avgHoldHours: null,
  };
  if (closed.length === 0) return empty;

  const pnls = closed.map((t) => Number(t.realized_pnl));
  const wins = pnls.filter((p) => p > 0);
  const losses = pnls.filter((p) => p < 0);
  const grossWin = wins.reduce((a, b) => a + b, 0);
  const grossLoss = Math.abs(losses.reduce((a, b) => a + b, 0));
  const totalPnl = pnls.reduce((a, b) => a + b, 0);

  const rs = closed.map(closedR).filter((r): r is number => r != null);
  const winRs = rs.filter((r) => r > 0);
  const lossRs = rs.filter((r) => r < 0);

  let equity = notional;
  let peak = notional;
  let maxDd = 0;
  for (const p of pnls) {
    equity += p;
    peak = Math.max(peak, equity);
    maxDd = Math.max(maxDd, peak - equity);
  }

  const holds = closed
    .filter((t) => t.exit_time)
    .map(
      (t) =>
        (new Date(t.exit_time!).getTime() - new Date(t.entry_time).getTime()) / 3_600_000,
    )
    .filter((h) => h >= 0);

  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

  return {
    count: closed.length,
    totalPnl: +totalPnl.toFixed(2),
    pctOfNotional: notional > 0 ? +((totalPnl / notional) * 100).toFixed(2) : 0,
    winRate: +((wins.length / closed.length) * 100).toFixed(1),
    avgWin: wins.length ? +(grossWin / wins.length).toFixed(2) : null,
    avgLoss: losses.length ? +(-grossLoss / losses.length).toFixed(2) : null,
    avgWinR: winRs.length ? +mean(winRs)!.toFixed(2) : null,
    avgLossR: lossRs.length ? +mean(lossRs)!.toFixed(2) : null,
    profitFactor: grossLoss > 0 ? +(grossWin / grossLoss).toFixed(2) : null,
    expectancy: +(totalPnl / closed.length).toFixed(2),
    expectancyR: rs.length ? +mean(rs)!.toFixed(2) : null,
    maxDrawdown: +maxDd.toFixed(2),
    avgHoldHours: holds.length ? +mean(holds)!.toFixed(1) : null,
  };
}

/** Paper equity curve from realised P&L, in exit-time order. */
export function equityCurve(trades: PaperTradeRow[], notional: number): EquityPoint[] {
  const closed = trades
    .filter((t) => t.status === "closed" && t.realized_pnl != null && t.exit_time)
    .sort((a, b) => a.exit_time!.localeCompare(b.exit_time!));
  let equity = notional;
  const out: EquityPoint[] = [{ time: closed[0]?.entry_time ?? new Date().toISOString(), equity }];
  for (const t of closed) {
    equity += Number(t.realized_pnl);
    out.push({ time: t.exit_time!, equity: +equity.toFixed(2) });
  }
  return out;
}

export const SMALL_SAMPLE = 20;

export type SplitKey =
  | "category"
  | "conviction"
  | "cohort"
  | "tradability"
  | "exit_reason"
  | "overrides"
  | "direction"
  | "source"
  | "instrument";

export const SPLIT_LABEL: Record<SplitKey, string> = {
  category: "Event category",
  conviction: "Conviction band",
  cohort: "Cohort",
  tradability: "Tradability",
  exit_reason: "Exit reason",
  overrides: "As-signalled vs overridden",
  direction: "Direction",
  source: "Signal vs manual",
  instrument: "Stocks vs ETFs",
};


function bucketOf(t: PaperTradeRow, key: SplitKey): string {
  switch (key) {
    case "category":
      return t.category ?? "Uncategorised";
    case "conviction": {
      const s = t.conviction_score;
      if (s == null) return "Unscored";
      if (s >= 80) return "80+";
      if (s >= 65) return "65–79";
      if (s >= 55) return "55–64";
      return "Below threshold";
    }
    case "cohort":
      return t.cohort;
    case "tradability":
      return t.tradable ? "tradable_xm" : "not tradable";
    case "exit_reason":
      return t.exit_reason ? EXIT_REASON_LABEL[t.exit_reason] : "Unknown";
    case "overrides":
      return t.overrides_used ? "Overridden" : "As signalled";
    case "direction":
      return t.direction === "long" ? "Long" : "Short";
    case "source":
      return SOURCE_LABEL[t.source];
    case "instrument":
      return t.instrument_type === "etf" ? "ETFs" : "Stocks";
  }
}

export interface SplitRow {
  bucket: string;
  stats: BlotterStats;
}

export function splitStats(
  trades: PaperTradeRow[],
  key: SplitKey,
  notional: number,
): SplitRow[] {
  const groups = new Map<string, PaperTradeRow[]>();
  for (const t of trades.filter((x) => x.status === "closed")) {
    const b = bucketOf(t, key);
    const arr = groups.get(b) ?? [];
    arr.push(t);
    groups.set(b, arr);
  }
  return [...groups.entries()]
    .map(([bucket, rows]) => ({ bucket, stats: computeStats(rows, notional) }))
    .sort((a, b) => b.stats.totalPnl - a.stats.totalPnl);
}

export function fmtMoney(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function fmtR(n: number | null | undefined): string {
  return n == null || !Number.isFinite(n) ? "—" : `${n > 0 ? "+" : ""}${n.toFixed(2)}R`;
}

export function fmtDuration(fromIso: string, toIso?: string | null): string {
  const ms = new Date(toIso ?? Date.now()).getTime() - new Date(fromIso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const h = ms / 3_600_000;
  if (h < 1) return `${Math.max(1, Math.round(ms / 60_000))}m`;
  if (h < 48) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
}
