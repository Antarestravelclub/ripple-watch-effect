// The single guarded path for creating advisor-grade paper signals.
// A signal without a score, ATR, stop, target and invalidation is rejected.
import { atrFor } from "./atr.server";
import { atrLevels, EXPIRY_TRADING_DAYS, STOP_ATR_MULT } from "./signal-levels";
import { scoreConviction, CONVICTION_THRESHOLD } from "./conviction";
import { suggestedSizePct, DEFAULT_PORTFOLIO, type PortfolioSettings } from "./position-sizing";
import { analogueHitRate } from "./analogue-stats.server";
import { benchmarkPrice, BENCHMARK_SYMBOL } from "./benchmark.server";
import type { EventCategory } from "./ripple-data";

export interface CreateSignalInput {
  eventId: string;
  ticker: string;
  companyName: string | null;
  quoteSymbol: string;
  direction: "long" | "short";
  entryPrice: number;
  dayHigh: number | null;
  dayLow: number | null;
  rationale: string;
  strength: "Low" | "Medium" | "High";
  confidence: "Low" | "Medium" | "High";
  category: EventCategory;
  /** Headline + summary of the driving event, used to detect direct exposure. */
  eventText: string;
  eventPublishedAt: string;
  generatedBy: string;
}

export type CreateSignalResult =
  | { ok: true; id: string; score: number; sizePct: number; belowThreshold: boolean }
  | { ok: false; reason: string };

/** Reads the paper portfolio settings, falling back to the documented defaults. */
export async function portfolioSettings(): Promise<PortfolioSettings> {
  try {
    const { publicSupabase } = await import("./supabase-public.server");
    const { data } = await publicSupabase()
      .from("portfolio_settings")
      .select("notional_value,risk_per_trade_pct,max_position_pct")
      .limit(1);
    const row = data?.[0];
    if (!row) return DEFAULT_PORTFOLIO;
    return {
      notional_value: Number(row.notional_value),
      risk_per_trade_pct: Number(row.risk_per_trade_pct),
      max_position_pct: Number(row.max_position_pct),
    };
  } catch {
    return DEFAULT_PORTFOLIO;
  }
}

function namedInEvent(text: string, ticker: string, company: string | null): boolean {
  const t = text.toLowerCase();
  if (ticker && t.includes(ticker.toLowerCase())) return true;
  if (company) {
    const first = company.split(/[\s,.]+/)[0];
    if (first && first.length >= 4 && t.includes(first.toLowerCase())) return true;
  }
  return false;
}

export async function createSignal(
  input: CreateSignalInput,
  settings?: PortfolioSettings,
): Promise<CreateSignalResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  if (!(input.entryPrice > 0)) return { ok: false, reason: "no_entry_price" };

  // 1. Volatility. No usable daily history means no signal.
  const atr = await atrFor(input.quoteSymbol);
  if (atr == null) return { ok: false, reason: "insufficient_history" };

  const { stop, target } = atrLevels(input.entryPrice, input.direction, atr);
  if (!(stop > 0) || !(target > 0)) return { ok: false, reason: "invalid_levels" };

  // 2. Conviction rubric.
  const ageHours =
    (Date.now() - new Date(input.eventPublishedAt).getTime()) / 3_600_000;
  const hitRate = await analogueHitRate(input.ticker, input.direction, input.category);
  const breakdown = scoreConviction({
    strength: input.strength,
    confidence: input.confidence,
    named: namedInEvent(input.eventText, input.ticker, input.companyName),
    analogueHitRate: hitRate,
    eventAgeHours: ageHours,
  });
  const belowThreshold = breakdown.total < CONVICTION_THRESHOLD;

  // 3. Risk-based sizing (0 below threshold — tracked but not sized).
  const cfg = settings ?? (await portfolioSettings());
  const sizePct = suggestedSizePct(input.entryPrice, atr, breakdown.total, cfg);

  // 4. Machine-checkable kill conditions + the human-readable version.
  const dirWord = input.direction === "long" ? "below" : "above";
  const invalidationParams = {
    max_days_open: EXPIRY_TRADING_DAYS,
    close_beyond: stop,
    direction: input.direction === "long" ? "below" : "above",
    event_reversed: true,
  };
  const invalidationText =
    `Thesis is dead if ${input.ticker} closes ${dirWord} $${stop.toFixed(2)} ` +
    `(${STOP_ATR_MULT}× ATR from entry), if the driving event is superseded, ` +
    `or after ${EXPIRY_TRADING_DAYS} trading days without reaching $${target.toFixed(2)}.`;

  const benchmark = await benchmarkPrice();

  const { data, error } = await supabaseAdmin
    .from("signals")
    .insert({
      event_id: input.eventId,
      ticker: input.ticker,
      company_name: input.companyName,
      direction: input.direction,
      conviction: input.confidence === "High" ? 5 : input.confidence === "Medium" ? 3 : 2,
      conviction_score: breakdown.total,
      conviction_breakdown: { ...breakdown } as unknown as Record<string, number | boolean | null>,
      rationale: input.rationale,
      generated_by: input.generatedBy,
      signal_price: input.entryPrice,
      quote_symbol: input.quoteSymbol,
      price_status: "ok",
      atr_at_signal: atr,
      stop_price: stop,
      target_price: target,
      invalidation_price: stop,
      invalidation_text: invalidationText,
      invalidation_params: invalidationParams,
      suggested_size_pct: sizePct,
      below_threshold: belowThreshold,
      benchmark_symbol: BENCHMARK_SYMBOL,
      benchmark_entry_price: benchmark,
      benchmark_entry_estimated: false,
      mode: "paper",
      status: "open",
    })
    .select("id")
    .maybeSingle();

  if (error || !data) return { ok: false, reason: error?.message ?? "insert_failed" };

  await supabaseAdmin.from("price_snapshots").insert({
    signal_id: data.id,
    ticker: input.ticker,
    price: input.entryPrice,
    day_high: input.dayHigh,
    day_low: input.dayLow,
  });

  return {
    ok: true,
    id: data.id,
    score: breakdown.total,
    sizePct,
    belowThreshold,
  };
}
