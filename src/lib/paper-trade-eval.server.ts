// Automatic exits for paper trades. Runs inside the SAME 15-minute weekday
// evaluation cron as the signal evaluator — there is no second scheduler.
//
// Fills are always at the stop / target level, never at whatever price the cron
// happens to observe, so the stats cannot flatter the system. If the price feed
// is stale or missing for a symbol, exit evaluation is skipped for that cycle
// and logged loudly — trades are never closed on stale data.
import { pnlFor, STALE_QUOTE_MS } from "./paper-trades";

export interface PaperExitResult {
  openTrades: number;
  evaluated: number;
  stopHits: number;
  targetHits: number;
  invalidated: number;
  bothTouched: number;
  skippedStale: number;
  staleSymbols: string[];
}

export async function runPaperTradeExits(): Promise<PaperExitResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { quotesFor } = await import("./latest-prices.server");

  const out: PaperExitResult = {
    openTrades: 0,
    evaluated: 0,
    stopHits: 0,
    targetHits: 0,
    invalidated: 0,
    bothTouched: 0,
    skippedStale: 0,
    staleSymbols: [],
  };

  const { data: trades, error } = await supabaseAdmin
    .from("paper_trades")
    .select(
      "id,user_id,signal_id,source,ticker,quote_symbol,direction,entry_price,entry_time,stop_price,target_price,position_size",
    )
    .eq("status", "open");
  if (error) throw new Error(error.message);
  if (!trades || trades.length === 0) return out;
  out.openTrades = trades.length;

  const symbols = [
    ...new Set(trades.map((t) => (t.quote_symbol || t.ticker).toUpperCase())),
  ];
  const quotes = await quotesFor(symbols);

  // Linked signals whose invalidation has already fired. Free-form manual
  // trades have no signal, so they can only exit on stop, target or by hand.
  const signalIds = [
    ...new Set(trades.map((t) => t.signal_id).filter((id): id is string => Boolean(id))),
  ];
  const invalidatedSignals = new Set<string>();
  if (signalIds.length > 0) {
    const { data: signals } = await supabaseAdmin
      .from("signals")
      .select("id,status")
      .in("id", signalIds);
    for (const s of signals ?? []) if (s.status === "invalidated") invalidatedSignals.add(s.id);
  }


  const now = new Date().toISOString();

  for (const t of trades) {
    const symbol = (t.quote_symbol || t.ticker).toUpperCase();
    const q = quotes.get(symbol);
    const quoteAge = q?.quoteTime ? Date.now() - new Date(q.quoteTime).getTime() : null;
    const stale = !q || quoteAge == null || quoteAge > STALE_QUOTE_MS;

    if (stale) {
      out.skippedStale++;
      if (!out.staleSymbols.includes(symbol)) out.staleSymbols.push(symbol);
      console.warn(
        `[paper-blotter] SKIPPED exit evaluation for ${symbol} (trade ${t.id}) — price feed stale or missing. No trade closed on stale data.`,
      );
      if (t.signal_id) {
        await supabaseAdmin.from("signal_evaluation_log").insert({
          signal_id: t.signal_id,
          trigger: "paper_exit_skipped_stale_feed",
          price: q?.price ?? null,
          detail: `Paper trade ${t.id} (${symbol}) skipped: quote ${
            quoteAge == null ? "missing" : `${Math.round(quoteAge / 60_000)}m old`
          }`,
        });
      }
      continue;
    }

    out.evaluated++;
    const dir = t.direction as "long" | "short";
    const entry = Number(t.entry_price);
    const stop = Number(t.stop_price);
    const target = Number(t.target_price);
    const size = Number(t.position_size);

    // Intraday-accurate period range: the same snapshot history the signal
    // evaluator uses, restricted to the life of this trade, plus the live quote.
    // Manual trades have no snapshot history, so they use the stored day range.
    const hist = t.signal_id
      ? (
          await supabaseAdmin
            .from("price_snapshots")
            .select("price,day_high,day_low,captured_at")
            .eq("signal_id", t.signal_id)
            .gte("captured_at", t.entry_time)
        ).data
      : null;

    const bars = [
      ...(hist ?? []).map((h) => {
        const p = Number(h.price);
        const hi = h.day_high != null ? Number(h.day_high) : p;
        const lo = h.day_low != null ? Number(h.day_low) : p;
        return { high: Math.max(hi, p), low: Math.min(lo, p) };
      }),
      {
        high: Math.max(q.dayHigh ?? q.price, q.price),
        low: Math.min(q.dayLow ?? q.price, q.price),
      },
    ];


    let hitStop = false;
    let hitTarget = false;
    for (const b of bars) {
      if (dir === "long") {
        if (b.low <= stop) hitStop = true;
        if (b.high >= target) hitTarget = true;
      } else {
        if (b.high >= stop) hitStop = true;
        if (b.low <= target) hitTarget = true;
      }
    }

    let exitPrice: number | null = null;
    let reason: "stop_hit" | "target_hit" | "invalidated" | null = null;
    const bothTouched = hitStop && hitTarget;

    if (hitStop) {
      // Conservative fill assumption: the stop went first.
      exitPrice = stop;
      reason = "stop_hit";
    } else if (hitTarget) {
      exitPrice = target;
      reason = "target_hit";
    } else if (t.signal_id && invalidatedSignals.has(t.signal_id)) {
      exitPrice = q.price;
      reason = "invalidated";
    }
    if (!reason || exitPrice == null) continue;

    const pnl = pnlFor(dir, entry, exitPrice, size);
    const { error: upErr } = await supabaseAdmin
      .from("paper_trades")
      .update({
        status: "closed",
        exit_price: exitPrice,
        exit_time: now,
        exit_reason: reason,
        realized_pnl: pnl,
        both_touched: bothTouched,
      })
      .eq("id", t.id)
      .eq("status", "open");
    if (upErr) {
      console.warn(`[paper-blotter] failed to close trade ${t.id}: ${upErr.message}`);
      continue;
    }

    if (bothTouched) out.bothTouched++;
    if (reason === "stop_hit") out.stopHits++;
    else if (reason === "target_hit") out.targetHits++;
    else out.invalidated++;

    const detail = `Paper trade ${t.id} ${t.ticker} ${dir} closed at ${exitPrice} (${reason}${
      bothTouched ? ", both levels touched — stop assumed first" : ""
    }), P&L ${pnl}`;
    if (t.signal_id) {
      await supabaseAdmin.from("signal_evaluation_log").insert({
        signal_id: t.signal_id,
        trigger: `paper_${reason}`,
        price: exitPrice,
        detail,
      });
    } else {
      console.info(`[paper-blotter] manual paper_${reason}: ${detail}`);
    }
  }

  return out;
}
