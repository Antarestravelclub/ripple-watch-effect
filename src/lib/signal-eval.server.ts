// Server-only evaluation engine for open signals.
// Recomputes magnitude-aware levels, refreshes prices, and resolves signals
// into target / invalidation / expired outcomes.
import { eventMagnitudes } from "./event-magnitude.server";
import { tickerMeta } from "./ticker-registry";
import { levelsFor, tradingDaysBetween, EXPIRY_TRADING_DAYS, type RippleMagnitude } from "./signal-levels";
import { fetchQuoteWithRetry, sleep } from "./signal-prices.server";

export interface EvalResult {
  evaluated: number;
  relevelled: number;
  targetHits: number;
  invalidated: number;
  expired: number;
  priced: number;
}

export async function runEvaluation(): Promise<EvalResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const apiKey = process.env.FINNHUB_API_KEY ?? "";

  /** Records the run so the Scorecard can show when signals were last checked. */
  const record = async (out: EvalResult, error: string | null) => {
    await supabaseAdmin.from("evaluation_runs").insert({
      finished_at: new Date().toISOString(),
      evaluated: out.evaluated,
      relevelled: out.relevelled,
      target_hits: out.targetHits,
      invalidated: out.invalidated,
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
      "id,event_id,ticker,quote_symbol,direction,signal_price,target_price,invalidation_price,signal_timestamp,status",
    )
    .eq("status", "open");
  if (error) throw new Error(error.message);

  const out: EvalResult = {
    evaluated: 0,
    relevelled: 0,
    targetHits: 0,
    invalidated: 0,
    expired: 0,
    priced: 0,
  };

  const open = (rows ?? []).filter((r) => r.signal_price != null);
  if (open.length === 0) return out;

  // 1. Make sure every open signal has magnitude-aware levels.
  for (const s of open) {
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

  // 2. Refresh prices once per unique quote symbol.
  const symbols = new Set<string>();
  for (const s of open) {
    const sym = s.quote_symbol ?? tickerMeta(s.ticker).quote;
    if (sym) symbols.add(sym);
  }
  const priceBySymbol = new Map<string, number>();
  const rangeBySymbol = new Map<string, { high: number | null; low: number | null }>();
  for (const sym of symbols) {
    const q = await fetchQuoteWithRetry(sym, apiKey);
    if (q.price != null) priceBySymbol.set(sym, q.price);
    rangeBySymbol.set(sym, { high: q.dayHigh ?? null, low: q.dayLow ?? null });
    await sleep(120);
  }
  out.priced = priceBySymbol.size;

  const snapshots: Array<{
    signal_id: string;
    ticker: string;
    price: number;
    day_high: number | null;
    day_low: number | null;
  }> = [];
  const now = new Date().toISOString();

  // 3. Resolve.
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
    const inv = s.invalidation_price != null ? Number(s.invalidation_price) : null;

    let hitTarget = false;
    let hitInv = false;
    for (const b of bars) {
      if (target != null && (dir === "long" ? b.high >= target : b.low <= target))
        hitTarget = true;
      if (inv != null && (dir === "long" ? b.low <= inv : b.high >= inv)) hitInv = true;
    }

    let reason: "target" | "invalidation" | "expired" | null = null;
    if (hitTarget) reason = "target";
    else if (hitInv) reason = "invalidation";
    else if (days >= EXPIRY_TRADING_DAYS) reason = "expired";
    if (!reason) continue;


    const lastClose = (hist ?? []).length
      ? Number((hist ?? [])[(hist ?? []).length - 1]!.price)
      : null;
    const closePrice =
      reason === "target" ? (target ?? price ?? null)
      : reason === "invalidation" ? (inv ?? price ?? null)
      : (price ?? lastClose);


    await supabaseAdmin
      .from("signals")
      .update({
        status: "closed",
        close_reason: reason,
        closed_price: closePrice,
        closed_at: now,
      })
      .eq("id", s.id);

    if (reason === "target") out.targetHits++;
    else if (reason === "invalidation") out.invalidated++;
    else out.expired++;
  }

  if (snapshots.length > 0) {
    await supabaseAdmin.from("price_snapshots").insert(snapshots);
  }

  return out;
}
