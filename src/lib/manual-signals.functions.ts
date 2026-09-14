// Server functions for user-authored ("manual") signals.
// Signed-in only. A manual signal runs the exact same pipeline as an engine
// signal — latest stored price as entry, ATR(14) stop/target, conviction
// rubric, risk-based size suggestion, benchmark capture — and is tagged
// generated_by = 'manual' with the owner's user_id.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { STALE_QUOTE_MS } from "./paper-trades";
import { CONVICTION_THRESHOLD, scoreConviction } from "./conviction";
import { EXPIRY_TRADING_DAYS, STOP_ATR_MULT, atrLevels } from "./signal-levels";

const SYMBOL_RE = /^[A-Z0-9.\-^]{1,15}$/;
const LEVELS = ["Low", "Medium", "High"] as const;
const THEMES = [
  "Geopolitical",
  "Central Bank",
  "Commodity",
  "Regulation",
  "Tech",
  "Weather/Disaster",
] as const;

const Direction = z.enum(["long", "short"]);
const Level = z.enum(LEVELS);
const Theme = z.enum(THEMES);

/**
 * Pre-fill for the "Add my signal" form: latest stored price plus the
 * ATR(14)-scaled stop and target the signal would be created with.
 */
export const manualSignalPrefill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { symbol: string; direction: "long" | "short" }) =>
    z.object({ symbol: z.string(), direction: Direction }).parse(d),
  )
  .handler(async ({ data }) => {
    const { quotesFor } = await import("./latest-prices.server");
    const { atrFor } = await import("./atr.server");

    const symbol = data.symbol.trim().toUpperCase();
    if (!SYMBOL_RE.test(symbol)) throw new Error("That doesn't look like a symbol");

    const q = (await quotesFor([symbol])).get(symbol);
    if (!q) throw new Error(`No price data available for ${symbol}`);

    const atr = await atrFor(symbol);
    const levels = atr != null && q.price > 0 ? atrLevels(q.price, data.direction, atr) : null;

    const quoteTime = q.quoteTime ?? null;
    const ageMs = quoteTime ? Date.now() - new Date(quoteTime).getTime() : null;

    return {
      symbol,
      direction: data.direction,
      entryPrice: q.price,
      quoteTime,
      quoteStale: ageMs == null || ageMs > STALE_QUOTE_MS,
      atr,
      enoughHistory: atr != null,
      stopPrice: levels?.stop ?? null,
      targetPrice: levels?.target ?? null,
      dayHigh: q.dayHigh ?? null,
      dayLow: q.dayLow ?? null,
    };
  });

/**
 * Creates the signed-in user's own signal. Same guards as engine signals:
 * a real stored price and enough daily history for ATR are required.
 */
export const createManualSignal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      symbol: string;
      direction: "long" | "short";
      thesis: string;
      strength: "Low" | "Medium" | "High";
      confidence: "Low" | "Medium" | "High";
      theme: (typeof THEMES)[number];
    }) =>
      z
        .object({
          symbol: z.string(),
          direction: Direction,
          thesis: z.string().trim().min(10, "Give the thesis a sentence or two").max(2000),
          strength: Level,
          confidence: Level,
          theme: Theme,
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { quotesFor } = await import("./latest-prices.server");
    const { atrFor } = await import("./atr.server");
    const { analogueHitRate } = await import("./analogue-stats.server");
    const { benchmarkPrice, BENCHMARK_SYMBOL } = await import("./benchmark.server");
    const { suggestedSizePct } = await import("./position-sizing");
    const { portfolioSettings } = await import("./signal-create.server");
    const { tickerMeta } = await import("./ticker-registry");

    const symbol = data.symbol.trim().toUpperCase();
    if (!SYMBOL_RE.test(symbol)) throw new Error("That doesn't look like a symbol");

    // One open manual signal per symbol + direction per user.
    const { data: existing } = await supabaseAdmin
      .from("signals")
      .select("id")
      .eq("user_id", context.userId)
      .eq("ticker", symbol)
      .eq("direction", data.direction)
      .eq("status", "open")
      .maybeSingle();
    if (existing) {
      throw new Error(`You already have an open ${data.direction} signal on ${symbol}.`);
    }

    const q = (await quotesFor([symbol])).get(symbol);
    if (!q || !(q.price > 0)) {
      throw new Error(`No price data available for ${symbol} — cannot create a signal.`);
    }
    const entry = q.price;

    const atr = await atrFor(symbol);
    if (atr == null) {
      throw new Error(
        `Not enough daily price history for ${symbol} to set volatility-based stop and target.`,
      );
    }
    const { stop, target } = atrLevels(entry, data.direction, atr);

    // Same conviction rubric as engine signals; a fresh manual idea counts as
    // age-zero fresh, and "named" is whether the thesis names the symbol.
    const meta = tickerMeta(symbol);
    const thesisLower = data.thesis.toLowerCase();
    const named =
      thesisLower.includes(symbol.toLowerCase()) ||
      (meta.name != null && meta.name.length >= 4 && thesisLower.includes(meta.name.toLowerCase()));
    const hitRate = await analogueHitRate(symbol, data.direction, data.theme);
    const breakdown = scoreConviction({
      strength: data.strength,
      confidence: data.confidence,
      named,
      analogueHitRate: hitRate,
      eventAgeHours: 0,
    });
    const belowThreshold = breakdown.total < CONVICTION_THRESHOLD;

    const settings = await portfolioSettings();
    const sizePct = suggestedSizePct(entry, atr, breakdown.total, settings);

    const dirWord = data.direction === "long" ? "below" : "above";
    const invalidationParams = {
      max_days_open: EXPIRY_TRADING_DAYS,
      close_beyond: stop,
      direction: data.direction === "long" ? "below" : "above",
      event_reversed: false,
    };
    const invalidationText =
      `Thesis is dead if ${symbol} closes ${dirWord} $${stop.toFixed(2)} ` +
      `(${STOP_ATR_MULT}× ATR from entry), or after ${EXPIRY_TRADING_DAYS} trading ` +
      `days without reaching $${target.toFixed(2)}.`;

    const { etfTickerSet } = await import("./etf-reference.server");
    const etfs = await etfTickerSet().catch(() => new Set<string>());

    const benchmark = await benchmarkPrice();

    const { data: row, error } = await supabaseAdmin
      .from("signals")
      .insert({
        event_id: `manual:${crypto.randomUUID()}`,
        user_id: context.userId,
        ticker: symbol,
        company_name: meta.name ?? null,
        direction: data.direction,
        conviction: data.confidence === "High" ? 5 : data.confidence === "Medium" ? 3 : 2,
        conviction_score: breakdown.total,
        conviction_breakdown: { ...breakdown } as unknown as Record<string, number | boolean | null>,
        rationale: data.thesis,
        generated_by: "manual",
        signal_price: entry,
        quote_symbol: meta.quote || symbol,
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
        benchmark_source: "exact",
        mode: "paper",
        status: "open",
        instrument_type: etfs.has(symbol) ? "etf" : "stock",
      })
      .select("id")
      .maybeSingle();

    if (error || !row) throw new Error(error?.message ?? "Could not create the signal");

    await supabaseAdmin.from("price_snapshots").insert({
      signal_id: row.id,
      ticker: symbol,
      price: entry,
      day_high: q.dayHigh ?? null,
      day_low: q.dayLow ?? null,
    });

    return {
      id: row.id,
      score: breakdown.total,
      belowThreshold,
      stop,
      target,
      sizePct,
    };
  });
