// Server functions for the Signal Tracker.
// Keep this file to createServerFn declarations only — helpers are imported.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { EVENTS } from "./ripple-data";
import { tickerMeta } from "./ticker-registry";
import type { SignalRow, SnapshotRow } from "./signal-metrics";

function convictionFromStrength(s: "Low" | "Medium" | "High"): number {
  return s === "High" ? 5 : s === "Medium" ? 3 : 2;
}

/** Idempotently seed signals for every event in EVENTS, with a snapshot price. */
export const ensureSignals = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { fetchQuoteWithRetry, sleep } = await import("./signal-prices.server");
  const { levelsFor } = await import("./signal-levels");
  const apiKey = process.env.FINNHUB_API_KEY ?? "";

  const { data: existing } = await supabaseAdmin
    .from("signals")
    .select("event_id,ticker,direction,generated_by");
  const seen = new Set(
    (existing ?? []).map(
      (r) => `${r.event_id}|${r.ticker}|${r.direction}|${r.generated_by}`,
    ),
  );

  type Outcome = Awaited<ReturnType<typeof fetchQuoteWithRetry>>;
  const cache = new Map<string, Outcome>();
  async function getPrice(symbol: string): Promise<Outcome> {
    if (cache.has(symbol)) return cache.get(symbol)!;
    const r = await fetchQuoteWithRetry(symbol, apiKey);
    cache.set(symbol, r);
    await sleep(250);
    return r;
  }

  let inserted = 0;
  const skipped: Array<{ ticker: string; reason: string }> = [];
  const failures: Array<{ ticker: string; status: string; message: string | null }> = [];

  for (const ev of EVENTS) {
    const strength = convictionFromStrength(ev.strength);
    const groups: Array<{ dir: "long" | "short"; groups: typeof ev.tailwinds }> = [
      { dir: "long", groups: ev.tailwinds },
      { dir: "short", groups: ev.headwinds },
    ];
    for (const { dir, groups: gs } of groups) {
      for (const g of gs) {
        for (const ticker of g.tickers) {
          const meta = tickerMeta(ticker);
          if (!meta.tradable) {
            skipped.push({ ticker, reason: meta.note ?? "Not publicly traded" });
            continue;
          }
          const key = `${ev.id}|${ticker}|${dir}|ripple-v1`;
          if (seen.has(key)) continue;
          const out = await getPrice(meta.quote);
          if (out.status !== "ok")
            failures.push({ ticker, status: out.status, message: out.message });
          const lv =
            out.price != null ? levelsFor(out.price, dir, ev.strength) : null;
          const { data, error } = await supabaseAdmin
            .from("signals")
            .insert({
              event_id: ev.id,
              ticker,
              direction: dir,
              conviction: strength,
              rationale: g.mechanism,
              generated_by: "ripple-v1",
              signal_price: out.price,
              quote_symbol: meta.quote,
              price_status: out.status,
              price_error: out.message,
              needs_review: out.status === "unsupported_symbol",
              target_price: lv?.target ?? null,
              invalidation_price: lv?.invalidation ?? null,
            })
            .select("id")
            .maybeSingle();
          if (!error && data && out.price != null) {
            await supabaseAdmin
              .from("price_snapshots")
              .insert({ signal_id: data.id, ticker, price: out.price });
          }
          if (!error) inserted++;
          seen.add(key);
        }
      }
    }
  }
  return { inserted, skipped, failures };
});

/**
 * Backfills a snapshot price for every signal missing one, and records the
 * exact reason when the market feed can't price a symbol.
 */
export const repairSignalPrices = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { fetchQuoteWithRetry, sleep } = await import("./signal-prices.server");
  const { levelsFor } = await import("./signal-levels");
  const magnitudeByEvent = new Map(EVENTS.map((e) => [e.id, e.strength]));
  const apiKey = process.env.FINNHUB_API_KEY ?? "";
  if (!apiKey)
    return {
      repaired: 0,
      flagged: 0,
      report: [{ ticker: "*", status: "no_key", message: "Market feed key not configured" }],
    };

  const { data: rows, error } = await supabaseAdmin
    .from("signals")
    .select("id,ticker,direction,event_id")
    .is("signal_price", null);
  if (error) throw new Error(error.message);

  const report: Array<{ ticker: string; status: string; message: string | null }> = [];
  const cache = new Map<string, Awaited<ReturnType<typeof fetchQuoteWithRetry>>>();
  let repaired = 0;
  let flagged = 0;

  for (const s of rows ?? []) {
    const meta = tickerMeta(s.ticker);
    if (!meta.tradable) {
      await supabaseAdmin
        .from("signals")
        .update({
          price_status: "not_tradable",
          price_error: meta.note ?? "Not publicly traded",
          needs_review: true,
          quote_symbol: null,
        })
        .eq("id", s.id);
      flagged++;
      report.push({ ticker: s.ticker, status: "not_tradable", message: meta.note ?? null });
      continue;
    }
    let out = cache.get(meta.quote);
    if (!out) {
      out = await fetchQuoteWithRetry(meta.quote, apiKey);
      cache.set(meta.quote, out);
      await sleep(250);
    }
    report.push({ ticker: s.ticker, status: out.status, message: out.message });

    if (out.price == null) {
      await supabaseAdmin
        .from("signals")
        .update({
          price_status: out.status,
          price_error: out.message,
          quote_symbol: meta.quote,
          needs_review: out.status === "unsupported_symbol",
        })
        .eq("id", s.id);
      if (out.status === "unsupported_symbol") flagged++;
      continue;
    }

    const lv = levelsFor(
      out.price,
      s.direction as "long" | "short",
      magnitudeByEvent.get(s.event_id) ?? "Medium",
    );
    await supabaseAdmin
      .from("signals")
      .update({
        signal_price: out.price,
        target_price: lv.target,
        invalidation_price: lv.invalidation,
        quote_symbol: meta.quote,
        price_status: "ok",
        price_error: null,
        needs_review: false,
      })
      .eq("id", s.id);
    await supabaseAdmin
      .from("price_snapshots")
      .insert({ signal_id: s.id, ticker: s.ticker, price: out.price });
    repaired++;
  }

  return { repaired, flagged, report };
});

/** Validates every ticker used by the app against the price source. */
export const validateTickers = createServerFn({ method: "POST" }).handler(async () => {
  const { resolveMany } = await import("./signal-prices.server");
  const apiKey = process.env.FINNHUB_API_KEY ?? "";
  const keys = new Set<string>();
  for (const ev of EVENTS)
    for (const g of [...ev.tailwinds, ...ev.headwinds])
      for (const t of g.tickers) keys.add(t);

  const metas = [...keys].map((k) => tickerMeta(k));
  const quotable = metas.filter((m) => m.tradable);
  const resolved = await resolveMany(
    quotable.map((m) => m.quote),
    apiKey,
  );

  const rows = metas.map((m) => {
    if (!m.tradable)
      return {
        ticker: m.key,
        display: m.display,
        quote: null,
        ok: false,
        status: "not_tradable",
        message: m.note ?? "Not publicly traded",
      };
    const r = resolved.get(m.quote)!;
    return {
      ticker: m.key,
      display: m.display,
      quote: m.quote,
      ok: r.status === "ok",
      status: r.status,
      message: r.message,
    };
  });
  return { rows, failing: rows.filter((r) => !r.ok).length };
});


/** List all signals with lightweight current-price info. */
export const listSignals = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: signals, error } = await supabaseAdmin
    .from("signals")
    .select("*")
    .order("signal_timestamp", { ascending: false });
  if (error) throw new Error(error.message);

  // Latest snapshot per signal
  const ids = (signals ?? []).map((s) => s.id);
  const latest = new Map<string, { price: number; captured_at: string }>();
  if (ids.length > 0) {
    const { data: snaps } = await supabaseAdmin
      .from("price_snapshots")
      .select("signal_id,price,captured_at")
      .in("signal_id", ids)
      .order("captured_at", { ascending: false });
    for (const s of snaps ?? []) {
      if (!latest.has(s.signal_id))
        latest.set(s.signal_id, { price: Number(s.price), captured_at: s.captured_at });
    }
  }

  return {
    signals: (signals ?? []) as unknown as SignalRow[],
    latest: Object.fromEntries(latest),
  };
});

/** Signals for a single event. */
export const listSignalsForEvent = createServerFn({ method: "GET" })
  .inputValidator((d: { eventId: string }) => z.object({ eventId: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signals, error } = await supabaseAdmin
      .from("signals")
      .select("*")
      .eq("event_id", data.eventId)
      .order("direction", { ascending: true })
      .order("conviction", { ascending: false });
    if (error) throw new Error(error.message);
    const ids = (signals ?? []).map((s) => s.id);
    const latest: Record<string, { price: number; captured_at: string }> = {};
    if (ids.length > 0) {
      const { data: snaps } = await supabaseAdmin
        .from("price_snapshots")
        .select("signal_id,price,captured_at")
        .in("signal_id", ids)
        .order("captured_at", { ascending: false });
      for (const s of snaps ?? []) {
        if (!latest[s.signal_id])
          latest[s.signal_id] = { price: Number(s.price), captured_at: s.captured_at };
      }
    }
    return { signals: (signals ?? []) as unknown as SignalRow[], latest };
  });

/** One signal + its full snapshot history. */
export const getSignal = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signal, error } = await supabaseAdmin
      .from("signals")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!signal) return { signal: null, snapshots: [] as SnapshotRow[] };
    const { data: snaps } = await supabaseAdmin
      .from("price_snapshots")
      .select("price,captured_at")
      .eq("signal_id", data.id)
      .order("captured_at", { ascending: true });
    return {
      signal: signal as unknown as SignalRow,
      snapshots: (snaps ?? []).map((s) => ({
        price: Number(s.price),
        captured_at: s.captured_at,
      })) as SnapshotRow[],
    };
  });

/**
 * Daily evaluation job: re-levels open signals from their event magnitude,
 * refreshes prices, and resolves each into target / invalidation / expired.
 */
export const evaluateSignals = createServerFn({ method: "POST" }).handler(async () => {
  const { runEvaluation } = await import("./signal-eval.server");
  return runEvaluation();
});
