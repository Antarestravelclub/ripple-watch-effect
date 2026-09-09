// Pure, client-safe maths for the paper account's starting balance and
// minimum-lot handling. No I/O here so the Blotter, the dialog and the
// server functions all share one definition.

/** Every new paper account starts here until the owner changes it. */
export const DEFAULT_STARTING_BALANCE = 1_000;

/** Used when the broker file doesn't tell us the symbol's minimum volume. */
export const DEFAULT_MIN_LOT = 1;

export interface PaperAccountSettings {
  startingBalance: number;
  riskPerTradePct: number;
  maxPositionPct: number;
  defaultMinLot: number;
}

export const DEFAULT_PAPER_ACCOUNT: PaperAccountSettings = {
  startingBalance: DEFAULT_STARTING_BALANCE,
  riskPerTradePct: 0.5,
  maxPositionPct: 5,
  defaultMinLot: DEFAULT_MIN_LOT,
};

/** Rounds a raw size down onto the symbol's lot grid. */
export function roundToLotStep(size: number, step: number): number {
  if (!(step > 0)) return size;
  return +(Math.floor(size / step) * step).toFixed(6);
}

export interface SizingCheck {
  /** Risk-based size before any minimum-lot handling. */
  rawSize: number;
  /** Size after rounding down to the lot step (0 when below the minimum). */
  sizedLots: number;
  minLot: number;
  lotStep: number;
  /** True when the risk-based size can't be filled at this balance. */
  undersized: boolean;
  /** Cash at risk if the minimum lot stops out. */
  minLotRiskDollars: number | null;
  /** That risk as a % of the account balance. */
  minLotRiskPct: number | null;
  /** Cash needed to open the minimum lot. */
  minLotNotional: number | null;
}

/**
 * Works out whether the risk-based size survives the symbol's minimum lot, and
 * what the minimum lot actually risks against this account balance.
 */
export function checkSizing(args: {
  rawSize: number;
  entry: number;
  stop: number | null;
  balance: number;
  minLot: number;
  lotStep?: number | null;
}): SizingCheck {
  const minLot = args.minLot > 0 ? args.minLot : DEFAULT_MIN_LOT;
  const lotStep = args.lotStep && args.lotStep > 0 ? args.lotStep : minLot;
  const rawSize = args.rawSize > 0 ? args.rawSize : 0;

  const riskPerUnit =
    args.stop != null && args.stop > 0 && args.entry > 0 ? Math.abs(args.entry - args.stop) : null;
  const minLotRiskDollars = riskPerUnit != null ? +(riskPerUnit * minLot).toFixed(2) : null;
  const minLotRiskPct =
    minLotRiskDollars != null && args.balance > 0
      ? +((minLotRiskDollars / args.balance) * 100).toFixed(2)
      : null;
  const minLotNotional = args.entry > 0 ? +(args.entry * minLot).toFixed(2) : null;

  const undersized = rawSize > 0 ? rawSize < minLot : true;
  const sizedLots = undersized ? 0 : roundToLotStep(rawSize, lotStep);

  return {
    rawSize: +rawSize.toFixed(4),
    sizedLots,
    minLot,
    lotStep,
    undersized,
    minLotRiskDollars,
    minLotRiskPct,
    minLotNotional,
  };
}
