// Server-only evaluation engine for open signals.
// Recomputes magnitude-aware levels for legacy rows, refreshes prices, and
// resolves signals into stop / target / invalidation / expired outcomes.
import { eventMagnitudes } from "./event-magnitude.server";
import { tickerMeta } from "./ticker-registry";
import { levelsFor, tradingDaysBetween, EXPIRY_TRADING_DAYS, type RippleMagnitude } from "./signal-levels";
import { refreshLatestPrices } from "./latest-prices.server";
import { benchmarkPrice, BENCHMARK_SYMBOL } from "./benchmark.server";

export interface EvalResult {
  evaluated: number;
  relevelled: number;
  targetHits: number;
  invalidated: number;
  expired: number;
  priced: number;
  stopped: number;
}

/** Machine-checkable kill conditions stored on each advisor-grade signal. */
interface InvalidationParams {
  max_days_open?: number;
  close_beyond?: number;
  direction?: "above" | "below";
  event_reversed?: boolean;
}


export async function runEvaluation(): Promise<EvalResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const out: EvalResult = {
    evaluated: 0,
    relevelled: 0,
    targetHits: 0,
    invalidated: 0,
    expired: 0,
    priced: 0,
    stopped: 0,
  };

  /** Records the run so the Scorecard can show when signals were last checked. */
  const record = async (error: string | null) => {
    await supabaseAdmin.from("evaluation_runs").insert({
      finished_at: new Date().toISOString(),
      evaluated: out.evaluated,
      relevelled: out.relevelled,
      target_hits: out.targetHits,
      invalidated: out.invalidated + out.stopped,
      expired: out.expired,
      priced: out.priced,
      ok: error == null,
      error,
    });
  };

  const magnitudeByEvent = (await eventMagnitudes()) as Map<string, RippleMagnitude>;

  const { data: rows, error } = await supabaseAdmin
    .from("signals")
    .select(
      "id,event_id,ticker,quote_symbol,direction,signal_price,target_price,invalidation_price,stop_price,invalidation_params,atr_at_signal,benchmark_symbol,signal_timestamp,status",
    )
    .eq("status", "open");

  if (error) {
    await record(error.message);
    throw new Error(error.message);
  }

  const open = (rows ?? []).filter((r) => r.signal_price != null);
  if (open.length === 0) {
    await record(null);
    return out;
  }

  // 1. Legacy rows (no ATR stop) keep magnitude-aware percentage levels.
  //    Advisor-grade rows keep the ATR levels fixed from creation.
  for (const s of open) {
    if (s.stop_price != null) continue;
    const mag = magnitudeByEvent.get(s.event_id) ?? "Medium";
    const lv = levelsFor(Number(s.signal_price), s.direction as "long" | "short", mag);
    if (
      Number(s.target_price) !== lv.target ||
      Number(s.invalidation_price) !== lv.invalidation
    ) {
      await supabaseAdmin
        .from("signals")
        .update({ target_price: lv.target, invalidation_price: lv.invalidation })
        .eq("id", s.id);
      s.target_price = lv.target;
      s.invalidation_price = lv.invalidation;
      out.relevelled++;
    }
  }

  // 2. ONE batched provider fetch per run: the deduplicated set of open-signal
  //    symbols plus the benchmark. Everything below reads latest_prices.
  const symbols = new Set<string>([BENCHMARK_SYMBOL]);
  for (const s of open) {
    const sym = s.quote_symbol ?? tickerMeta(s.ticker).quote;
    if (sym) symbols.add(sym);
  }
  const { quotes } = await refreshLatestPrices([...symbols]);
  const priceBySymbol = new Map<string, number>();
  const rangeBySymbol = new Map<string, { high: number | null; low: number | null }>();
  for (const [sym, q] of quotes) {
    priceBySymbol.set(sym, q.price);
    rangeBySymbol.set(sym, { high: q.dayHigh, low: q.dayLow });
  }
  out.priced = priceBySymbol.size;


  // Events that have been archived or superseded kill their own signals.
  const eventIds = [...new Set(open.map((s) => s.event_id))];
  const reversedEvents = new Set<string>();
  if (eventIds.length > 0) {
    const { data: evs } = await supabaseAdmin
      .from("live_events")
      .select("id,archived")
      .in("id", eventIds.filter((id) => /^[0-9a-f-]{36}$/i.test(id)));
    for (const e of evs ?? []) if (e.archived) reversedEvents.add(e.id);
  }

  // One benchmark read per run, recorded on every close so alpha is computable.
  const benchmarkNow = priceBySymbol.get(BENCHMARK_SYMBOL) ?? (await benchmarkPrice());

  const snapshots: Array<{
    signal_id: string;
    ticker: string;
    price: number;
    day_high: number | null;
    day_low: number | null;
  }> = [];
  const now = new Date().toISOString();

  // 3. Resolve, in priority order: stop, target, then kill conditions.
  for (const s of open) {
    out.evaluated++;
    const sym = s.quote_symbol ?? tickerMeta(s.ticker).quote;
    const price = sym ? priceBySymbol.get(sym) : undefined;
    const range = sym ? rangeBySymbol.get(sym) : undefined;
    const dir = s.direction as "long" | "short";
    const days = tradingDaysBetween(s.signal_timestamp);

    if (price != null) {
      snapshots.push({
        signal_id: s.id,
        ticker: s.ticker,
        price,
        day_high: range?.high ?? null,
        day_low: range?.low ?? null,
      });
    }

    // Look at the full snapshot history, using each row's intraday range when
    // available, so a touch between polls isn't missed.
    const { data: hist } = await supabaseAdmin
      .from("price_snapshots")
      .select("price,day_high,day_low")
      .eq("signal_id", s.id);
    const bars: Array<{ high: number; low: number }> = [
      ...(hist ?? []).map((h) => {
        const p = Number(h.price);
        const hi = h.day_high != null ? Number(h.day_high) : p;
        const lo = h.day_low != null ? Number(h.day_low) : p;
        return { high: Math.max(hi, p), low: Math.min(lo, p) };
      }),
      ...(price != null
        ? [
            {
              high: Math.max(range?.high ?? price, price),
              low: Math.min(range?.low ?? price, price),
            },
          ]
        : []),
    ];

    const target = s.target_price != null ? Number(s.target_price) : null;
    const stop = s.stop_price != null ? Number(s.stop_price) : null;
    const inv = s.invalidation_price != null ? Number(s.invalidation_price) : null;
    const params = (s.invalidation_params ?? {}) as InvalidationParams;

    let hitTarget = false;
    let hitStop = false;
    let hitInv = false;
    for (const b of bars) {
      if (target != null && (dir === "long" ? b.high >= target : b.low <= target))
        hitTarget = true;
      if (stop != null && (dir === "long" ? b.low <= stop : b.high >= stop))
        hitStop = true;
      if (inv != null && (dir === "long" ? b.low <= inv : b.high >= inv)) hitInv = true;
    }

    // Machine-checkable kill conditions.
    const maxDays = params.max_days_open ?? EXPIRY_TRADING_DAYS;
    const timeStop = days >= maxDays;
    const beyond =
      params.close_beyond != null && price != null
        ? params.direction === "above"
          ? price >= params.close_beyond
          : price <= params.close_beyond
        : false;
    const eventReversed = params.event_reversed === true && reversedEvents.has(s.event_id);

    let status: "closed" | "stopped" | "invalidated" | null = null;
    let reason: string | null = null;
    if (stop != null && hitStop) {
      status = "stopped";
      reason = "stop";
    } else if (hitTarget) {
      status = "closed";
      reason = "target";
    } else if (eventReversed) {
      status = "invalidated";
      reason = "event_reversed";
    } else if (beyond) {
      status = "invalidated";
      reason = "close_beyond";
    } else if (stop == null && hitInv) {
      // Legacy rows resolve on their percentage invalidation level.
      status = "invalidated";
      reason = "invalidation";
    } else if (timeStop) {
      status = "invalidated";
      reason = "max_days_open";
    }
    if (!status || !reason) continue;

    const lastClose = (hist ?? []).length
      ? Number((hist ?? [])[(hist ?? []).length - 1]!.price)
      : null;
    const closePrice =
      reason === "target" ? (target ?? price ?? null)
      : reason === "stop" ? (stop ?? price ?? null)
      : reason === "invalidation" ? (inv ?? price ?? null)
      : (price ?? lastClose);

    await supabaseAdmin
      .from("signals")
      .update({
        status,
        close_reason: reason,
        closed_price: closePrice,
        closed_at: now,
        benchmark_exit_price: benchmarkNow,
      })
      .eq("id", s.id);

    // No silent state changes — every close is logged.
    await supabaseAdmin.from("signal_evaluation_log").insert({
      signal_id: s.id,
      trigger: reason,
      price: closePrice,
      benchmark_price: benchmarkNow,
      detail: `${s.ticker} ${dir} → ${status} after ${days} trading day(s)`,
    });

    if (reason === "target") out.targetHits++;
    else if (reason === "stop") out.stopped++;
    else if (reason === "max_days_open") out.expired++;
    else out.invalidated++;
  }

  if (snapshots.length > 0) {
    await supabaseAdmin.from("price_snapshots").insert(snapshots);
  }

  await record(null);
  return out;
}

