// Server functions for the Paper Trade Blotter.
// Every function is signed-in only. Prices come from the shared latest_prices
// store (never from a widget, never from a second provider path), and nothing
// here can route an order anywhere — paper measurement only.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pnlFor, STALE_QUOTE_MS, type PaperTradeRow } from "./paper-trades";

interface SignalForTrade {
  id: string;
  ticker: string;
  quote_symbol: string | null;
  direction: string;
  status: string;
  event_id: string;
  signal_price: number | null;
  stop_price: number | null;
  target_price: number | null;
  suggested_size_pct: number | null;
  atr_at_signal: number | null;
  conviction_score: number | null;
}

/** The owner's configurable starting balance — the base for all sizing and %. */
async function notionalValue(userId: string): Promise<number> {
  const { paperAccount } = await import("./paper-account.server");
  return (await paperAccount(userId)).startingBalance;
}

/** Tickers XM can actually trade, from the latest broker symbol upload. */
async function tradableTickers(): Promise<Set<string>> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: upload } = await supabaseAdmin
    .from("broker_symbol_uploads")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const out = new Set<string>();
  if (!upload) return out;
  const { data } = await supabaseAdmin
    .from("broker_symbols")
    .select("mapped_app_ticker")
    .eq("upload_id", upload.id)
    .in("mapping_status", ["auto_mapped", "manual_mapped"]);
  for (const r of data ?? []) if (r.mapped_app_ticker) out.add(r.mapped_app_ticker.toUpperCase());
  return out;
}

/** Pre-filled values for the "Paper Trade" form, straight from the signal. */
export const paperTradePrefill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { signalId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { quotesFor } = await import("./latest-prices.server");

    const { data: signal } = await supabaseAdmin
      .from("signals")
      .select(
        "id,ticker,quote_symbol,direction,status,event_id,signal_price,stop_price,target_price,suggested_size_pct,atr_at_signal,conviction_score",
      )
      .eq("id", data.signalId)
      .maybeSingle<SignalForTrade>();
    if (!signal) throw new Error("Signal not found");

    const { data: existing } = await supabaseAdmin
      .from("paper_trades")
      .select("id")
      .eq("user_id", context.userId)
      .eq("signal_id", signal.id)
      .eq("status", "open")
      .maybeSingle();

    const symbol = (signal.quote_symbol || signal.ticker).toUpperCase();
    const quotes = await quotesFor([symbol]);
    const q = quotes.get(symbol);
    const entry = q?.price ?? (signal.signal_price != null ? Number(signal.signal_price) : null);
    const quoteTime = q?.quoteTime ?? null;
    const ageMs = quoteTime ? Date.now() - new Date(quoteTime).getTime() : null;

    const notional = await notionalValue();
    const sizePct = signal.suggested_size_pct != null ? Number(signal.suggested_size_pct) : 0;
    const size =
      entry != null && entry > 0 && sizePct > 0
        ? +((notional * (sizePct / 100)) / entry).toFixed(4)
        : 0;

    return {
      signalId: signal.id,
      ticker: signal.ticker,
      quoteSymbol: symbol,
      direction: signal.direction as "long" | "short",
      signalStatus: signal.status,
      convictionScore: signal.conviction_score,
      entryPrice: entry,
      quoteTime,
      quoteStale: ageMs == null || ageMs > STALE_QUOTE_MS,
      stopPrice: signal.stop_price != null ? Number(signal.stop_price) : null,
      targetPrice: signal.target_price != null ? Number(signal.target_price) : null,
      positionSize: size,
      suggestedSizePct: sizePct,
      notional,
      hasOpenTrade: Boolean(existing),
    };
  });

/** Opens one paper trade for the signed-in user. One open trade per signal. */
export const openPaperTrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      signalId: string;
      entryPrice: number;
      stopPrice: number;
      targetPrice: number;
      positionSize: number;
      overridesUsed: boolean;
      notes?: string;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    for (const [k, v] of Object.entries({
      entryPrice: data.entryPrice,
      stopPrice: data.stopPrice,
      targetPrice: data.targetPrice,
      positionSize: data.positionSize,
    })) {
      if (!(Number(v) > 0)) throw new Error(`${k} must be greater than zero`);
    }

    const { data: signal } = await supabaseAdmin
      .from("signals")
      .select("id,ticker,quote_symbol,direction")
      .eq("id", data.signalId)
      .maybeSingle();
    if (!signal) throw new Error("Signal not found");

    const { data: row, error } = await supabaseAdmin
      .from("paper_trades")
      .insert({
        user_id: context.userId,
        signal_id: signal.id,
        ticker: signal.ticker,
        quote_symbol: (signal.quote_symbol || signal.ticker).toUpperCase(),
        direction: signal.direction,
        entry_price: data.entryPrice,
        entry_time: new Date().toISOString(),
        stop_price: data.stopPrice,
        target_price: data.targetPrice,
        position_size: data.positionSize,
        overrides_used: data.overridesUsed,
        notes: data.notes?.trim() ? data.notes.trim() : null,
        status: "open",
      })
      .select("id")
      .maybeSingle();

    if (error) {
      if (error.code === "23505" || error.message.includes("paper_trades_one_open_per_signal")) {
        throw new Error("You already have an open paper trade on this signal.");
      }
      throw new Error(error.message);
    }
    return { id: row?.id ?? null };
  });

/**
 * Pre-fill for a free-form paper trade on any symbol: latest stored price,
 * ATR(14)-scaled stop/target and risk-based size on the paper notional.
 */
export const manualTradePrefill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { symbol: string; direction: "long" | "short" }) => d)
  .handler(async ({ data }) => {
    const { quotesFor } = await import("./latest-prices.server");
    const { atrFor } = await import("./atr.server");
    const { atrLevels } = await import("./signal-levels");
    const { suggestedSizePct, DEFAULT_PORTFOLIO } = await import("./position-sizing");

    const symbol = data.symbol.trim().toUpperCase();
    if (!/^[A-Z0-9.\-^]{1,15}$/.test(symbol)) throw new Error("That doesn't look like a symbol");

    const q = (await quotesFor([symbol])).get(symbol);
    if (!q) throw new Error(`No price data available for ${symbol}`);

    const entry = q.price;
    const atr = await atrFor(symbol);
    const levels = atr != null && entry > 0 ? atrLevels(entry, data.direction, atr) : null;

    const notional = await notionalValue();
    // Manual trades have no conviction score, so they size at the medium band.
    const sizePct =
      atr != null && entry > 0
        ? suggestedSizePct(entry, atr, 70, { ...DEFAULT_PORTFOLIO, notional_value: notional })
        : 0;
    const size = sizePct > 0 && entry > 0 ? +((notional * (sizePct / 100)) / entry).toFixed(4) : 0;

    const quoteTime = q.quoteTime ?? null;
    const ageMs = quoteTime ? Date.now() - new Date(quoteTime).getTime() : null;

    return {
      ticker: symbol,
      quoteSymbol: symbol,
      direction: data.direction,
      entryPrice: entry,
      quoteTime,
      quoteStale: ageMs == null || ageMs > STALE_QUOTE_MS,
      stopPrice: levels?.stop ?? null,
      targetPrice: levels?.target ?? null,
      atr,
      positionSize: size,
      suggestedSizePct: sizePct,
      notional,
    };
  });

/** Opens a free-form paper trade on any symbol, unlinked from any signal. */
export const openManualPaperTrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      symbol: string;
      direction: "long" | "short";
      entryPrice: number;
      stopPrice: number;
      targetPrice: number;
      positionSize: number;
      notes?: string;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const symbol = data.symbol.trim().toUpperCase();
    if (!/^[A-Z0-9.\-^]{1,15}$/.test(symbol)) throw new Error("That doesn't look like a symbol");
    if (data.direction !== "long" && data.direction !== "short") {
      throw new Error("Direction must be long or short");
    }
    for (const [k, v] of Object.entries({
      entryPrice: data.entryPrice,
      stopPrice: data.stopPrice,
      targetPrice: data.targetPrice,
      positionSize: data.positionSize,
    })) {
      if (!(Number(v) > 0)) throw new Error(`${k} must be greater than zero`);
    }
    // Stop and target must sit on the right side of entry, or the exit logic
    // would fire immediately.
    if (data.direction === "long" && !(data.stopPrice < data.entryPrice)) {
      throw new Error("For a long, the stop must be below the entry price");
    }
    if (data.direction === "long" && !(data.targetPrice > data.entryPrice)) {
      throw new Error("For a long, the target must be above the entry price");
    }
    if (data.direction === "short" && !(data.stopPrice > data.entryPrice)) {
      throw new Error("For a short, the stop must be above the entry price");
    }
    if (data.direction === "short" && !(data.targetPrice < data.entryPrice)) {
      throw new Error("For a short, the target must be below the entry price");
    }

    const { data: existing } = await supabaseAdmin
      .from("paper_trades")
      .select("id")
      .eq("user_id", context.userId)
      .eq("source", "manual")
      .eq("ticker", symbol)
      .eq("direction", data.direction)
      .eq("status", "open")
      .maybeSingle();
    if (existing) {
      throw new Error(`You already have an open manual ${data.direction} on ${symbol}.`);
    }

    const { data: row, error } = await supabaseAdmin
      .from("paper_trades")
      .insert({
        user_id: context.userId,
        signal_id: null,
        source: "manual",
        ticker: symbol,
        quote_symbol: symbol,
        direction: data.direction,
        entry_price: data.entryPrice,
        entry_time: new Date().toISOString(),
        stop_price: data.stopPrice,
        target_price: data.targetPrice,
        position_size: data.positionSize,
        overrides_used: false,
        notes: data.notes?.trim() ? data.notes.trim() : null,
        status: "open",
      })
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { id: row?.id ?? null };
  });


/** Closes a trade manually at the current stored quote. */
export const closePaperTrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { quotesFor } = await import("./latest-prices.server");

    const { data: trade } = await supabaseAdmin
      .from("paper_trades")
      .select("id,ticker,quote_symbol,direction,entry_price,position_size,status")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!trade) throw new Error("Paper trade not found");
    if (trade.status !== "open") throw new Error("This paper trade is already closed");

    const symbol = (trade.quote_symbol || trade.ticker).toUpperCase();
    const q = (await quotesFor([symbol])).get(symbol);
    if (!q) throw new Error("No stored price available — cannot close on missing data");

    const pnl = pnlFor(
      trade.direction as "long" | "short",
      Number(trade.entry_price),
      q.price,
      Number(trade.position_size),
    );

    const { error } = await supabaseAdmin
      .from("paper_trades")
      .update({
        status: "closed",
        exit_price: q.price,
        exit_time: new Date().toISOString(),
        exit_reason: "manual",
        realized_pnl: pnl,
      })
      .eq("id", trade.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);

    // Mirrored trades get a matching close on the demo account.
    const { createCloseInstruction } = await import("./bridge-mirror.server");
    await createCloseInstruction(trade.id);

    return { exitPrice: q.price, realizedPnl: pnl };
  });

/** Everything the Blotter needs: trades, current prices, feed freshness. */
export const listPaperTrades = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { quotesFor } = await import("./latest-prices.server");

    const { data: raw, error } = await supabaseAdmin
      .from("paper_trades")
      .select("*")
      .eq("user_id", context.userId)
      .order("entry_time", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = raw ?? [];

    const signalIds = [
      ...new Set(rows.map((r) => r.signal_id).filter((id): id is string => Boolean(id))),
    ];
    const signalById = new Map<string, SignalForTrade>();
    if (signalIds.length > 0) {
      const { data: signals } = await supabaseAdmin
        .from("signals")
        .select(
          "id,ticker,quote_symbol,direction,status,event_id,signal_price,stop_price,target_price,suggested_size_pct,atr_at_signal,conviction_score",
        )
        .in("id", signalIds);
      for (const s of (signals ?? []) as SignalForTrade[]) signalById.set(s.id, s);
    }


    const eventIds = [
      ...new Set(
        [...signalById.values()]
          .map((s) => s.event_id)
          .filter((id) => /^[0-9a-f-]{36}$/i.test(id)),
      ),
    ];
    const categoryByEvent = new Map<string, string>();
    if (eventIds.length > 0) {
      const { data: evs } = await supabaseAdmin
        .from("live_events")
        .select("id,category")
        .in("id", eventIds);
      for (const e of evs ?? []) categoryByEvent.set(e.id, e.category);
    }

    const tradable = await tradableTickers();

    const trades: PaperTradeRow[] = rows.map((r) => {
      const s = r.signal_id ? signalById.get(r.signal_id) : undefined;
      return {
        id: r.id,
        signal_id: r.signal_id,
        source: (r.source === "manual" ? "manual" : "signal") as PaperTradeRow["source"],
        ticker: r.ticker,
        quote_symbol: r.quote_symbol,

        direction: r.direction as "long" | "short",
        entry_price: Number(r.entry_price),
        entry_time: r.entry_time,
        stop_price: Number(r.stop_price),
        target_price: Number(r.target_price),
        position_size: Number(r.position_size),
        status: r.status as "open" | "closed",
        exit_price: r.exit_price != null ? Number(r.exit_price) : null,
        exit_time: r.exit_time,
        exit_reason: r.exit_reason as PaperTradeRow["exit_reason"],
        realized_pnl: r.realized_pnl != null ? Number(r.realized_pnl) : null,
        overrides_used: r.overrides_used,
        both_touched: r.both_touched,
        notes: r.notes,
        category: s ? (categoryByEvent.get(s.event_id) ?? null) : null,
        conviction_score: s?.conviction_score ?? null,
        cohort: s?.atr_at_signal != null && s?.stop_price != null ? "atr_v1" : "legacy_pct",
        tradable: tradable.has(r.ticker.toUpperCase()),
        mirrored: Boolean(r.mirrored),
        mirror_ticket: r.mirror_ticket != null ? Number(r.mirror_ticket) : null,
        demo_fill_price: r.demo_fill_price != null ? Number(r.demo_fill_price) : null,
        demo_close_price: r.demo_close_price != null ? Number(r.demo_close_price) : null,
        demo_realized_pnl: r.demo_realized_pnl != null ? Number(r.demo_realized_pnl) : null,
      };
    });

    const openSymbols = [
      ...new Set(
        trades
          .filter((t) => t.status === "open")
          .map((t) => (t.quote_symbol || t.ticker).toUpperCase()),
      ),
    ];
    const quotes = openSymbols.length > 0 ? await quotesFor(openSymbols) : new Map();
    const prices: Record<string, { price: number; quoteTime: string | null }> = {};
    for (const [sym, q] of quotes) prices[sym] = { price: q.price, quoteTime: q.quoteTime };

    const newestQuote = Object.values(prices)
      .map((p) => (p.quoteTime ? new Date(p.quoteTime).getTime() : 0))
      .reduce((a, b) => Math.max(a, b), 0);

    return {
      trades,
      prices,
      notional: await notionalValue(),
      lastQuoteTime: newestQuote > 0 ? new Date(newestQuote).toISOString() : null,
      feedStale: openSymbols.length > 0 && (newestQuote === 0 || Date.now() - newestQuote > STALE_QUOTE_MS),
    };
  });
