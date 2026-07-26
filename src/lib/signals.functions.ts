// Server functions for the Signal Tracker.
// Keep this file to createServerFn declarations only — helpers are imported.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { EVENTS } from "./ripple-data";
import type { SignalRow, SnapshotRow } from "./signal-metrics";

function convictionFromStrength(s: "Low" | "Medium" | "High"): number {
  return s === "High" ? 5 : s === "Medium" ? 3 : 2;
}

async function fetchFinnhubQuote(
  ticker: string,
  apiKey: string,
): Promise<number | null> {
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(ticker)}&token=${apiKey}`,
    );
    if (!res.ok) return null;
    const j = (await res.json()) as { c?: number };
    if (typeof j.c === "number" && j.c > 0) return j.c;
    return null;
  } catch {
    return null;
  }
}

function derivedLevels(
  price: number,
  direction: "long" | "short",
): { target: number; invalidation: number } {
  if (direction === "long") {
    return { target: +(price * 1.1).toFixed(4), invalidation: +(price * 0.92).toFixed(4) };
  }
  return { target: +(price * 0.9).toFixed(4), invalidation: +(price * 1.08).toFixed(4) };
}

/** Idempotently seed signals for every event in EVENTS. Also fetches an initial price. */
export const ensureSignals = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const apiKey = process.env.FINNHUB_API_KEY ?? "";

  const { data: existing } = await supabaseAdmin
    .from("signals")
    .select("event_id,ticker,direction,generated_by");
  const seen = new Set(
    (existing ?? []).map(
      (r) => `${r.event_id}|${r.ticker}|${r.direction}|${r.generated_by}`,
    ),
  );

  const priceCache = new Map<string, number | null>();
  async function getPrice(t: string): Promise<number | null> {
    if (priceCache.has(t)) return priceCache.get(t)!;
    const p = apiKey ? await fetchFinnhubQuote(t, apiKey) : null;
    priceCache.set(t, p);
    return p;
  }

  let inserted = 0;
  for (const ev of EVENTS) {
    const strength = convictionFromStrength(ev.strength);
    const groups: Array<{
      dir: "long" | "short";
      groups: typeof ev.tailwinds;
    }> = [
      { dir: "long", groups: ev.tailwinds },
      { dir: "short", groups: ev.headwinds },
    ];
    for (const { dir, groups: gs } of groups) {
      for (const g of gs) {
        for (const ticker of g.tickers) {
          const key = `${ev.id}|${ticker}|${dir}|ripple-v1`;
          if (seen.has(key)) continue;
          const price = await getPrice(ticker);
          const row: Record<string, unknown> = {
            event_id: ev.id,
            ticker,
            direction: dir,
            conviction: strength,
            rationale: g.mechanism,
            generated_by: "ripple-v1",
            signal_price: price,
          };
          if (price != null) {
            const lv = derivedLevels(price, dir);
            row.target_price = lv.target;
            row.invalidation_price = lv.invalidation;
          }
          const { data, error } = await supabaseAdmin
            .from("signals")
            .insert(row)
            .select("id")
            .maybeSingle();
          if (!error && data && price != null) {
            await supabaseAdmin
              .from("price_snapshots")
              .insert({ signal_id: data.id, ticker, price });
            inserted++;
          } else if (!error) {
            inserted++;
          }
          seen.add(key);
        }
      }
    }
  }
  return { inserted };
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
