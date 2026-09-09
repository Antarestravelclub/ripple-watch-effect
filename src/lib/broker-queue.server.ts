// Demo-account order queue.
//
// The app never talks to a broker itself: it publishes intents into
// broker_orders, and a bridge process running next to a MetaTrader 5 *demo*
// terminal claims them, executes, and reports fills back. Every row is
// mode = 'demo' and belongs to one bridge owner, so one account can never
// claim or report another account's queued orders.

const MIN_CONVICTION = 55;

export interface QueueResult {
  opensQueued: number;
  closesQueued: number;
  skipped: number;
}

/**
 * Mirrors the current signal book into one owner's order queue.
 * - open signals that cleared conviction get one 'open' order
 * - resolved signals whose open order actually filled get one 'close' order
 * Both are deduplicated by (user_id, signal_id, intent) at the database level.
 */
export async function syncBrokerOrders(ownerId: string): Promise<QueueResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const out: QueueResult = { opensQueued: 0, closesQueued: 0, skipped: 0 };

  const { data: signals, error } = await supabaseAdmin
    .from("signals")
    .select(
      "id,ticker,direction,status,signal_price,stop_price,target_price,conviction_score,suggested_size_pct,below_threshold,needs_review,closed_price",
    )
    .order("signal_timestamp", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  if (!signals || signals.length === 0) return out;

  const { data: existing } = await supabaseAdmin
    .from("broker_orders")
    .select("signal_id,intent,status")
    .eq("user_id", ownerId)
    .in(
      "signal_id",
      signals.map((s) => s.id),
    );
  const seen = new Set((existing ?? []).map((o) => `${o.signal_id}:${o.intent}`));
  const filledOpen = new Set(
    (existing ?? [])
      .filter((o) => o.intent === "open" && o.status === "filled")
      .map((o) => o.signal_id),
  );

  // Load the latest broker-symbol mapping so queued orders carry the exact broker symbol.
  const { data: latestUpload } = await supabaseAdmin
    .from("broker_symbol_uploads")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const brokerSymbolMap = new Map<string, string>();
  if (latestUpload) {
    const { data: mappedSymbols } = await supabaseAdmin
      .from("broker_symbols")
      .select("mapped_app_ticker,broker_symbol")
      .eq("upload_id", latestUpload.id)
      .in("mapping_status", ["auto_mapped", "manual_mapped"]);
    for (const m of mappedSymbols ?? []) {
      if (m.mapped_app_ticker) brokerSymbolMap.set(m.mapped_app_ticker.toUpperCase(), m.broker_symbol);
    }
  }

  const rows: Record<string, unknown>[] = [];

  for (const s of signals) {
    if (s.status === "open") {
      if (seen.has(`${s.id}:open`)) continue;
      const score = s.conviction_score ?? 0;
      const size = s.suggested_size_pct ?? 0;
      if (
        s.needs_review ||
        s.below_threshold ||
        score < MIN_CONVICTION ||
        size <= 0 ||
        s.signal_price == null ||
        s.stop_price == null ||
        s.target_price == null
      ) {
        out.skipped++;
        continue;
      }
      rows.push({
        user_id: ownerId,
        signal_id: s.id,
        ticker: s.ticker,
        broker_symbol: brokerSymbolMap.get(s.ticker.toUpperCase()) ?? null,
        side: s.direction === "long" ? "buy" : "sell",
        intent: "open",
        mode: "demo",
        reference_price: s.signal_price,
        stop_price: s.stop_price,
        target_price: s.target_price,
        suggested_size_pct: size,
        conviction_score: score,
        status: "queued",
      });
      out.opensQueued++;
    } else if (filledOpen.has(s.id) && !seen.has(`${s.id}:close`)) {
      rows.push({
        user_id: ownerId,
        signal_id: s.id,
        ticker: s.ticker,
        broker_symbol: brokerSymbolMap.get(s.ticker.toUpperCase()) ?? null,
        // Closing reverses the original side.
        side: s.direction === "long" ? "sell" : "buy",
        intent: "close",
        mode: "demo",
        reference_price: s.closed_price,
        status: "queued",
      });
      out.closesQueued++;
    }
  }

  if (rows.length > 0) {
    const { error: insErr } = await supabaseAdmin.from("broker_orders").insert(rows as never);
    if (insErr) throw new Error(insErr.message);
  }
  return out;
}

/** Keeps every configured bridge owner's queue current from the scheduled job. */
export async function syncAllBrokerOrderBooks() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: owners, error } = await supabaseAdmin
    .from("bridge_secrets")
    .select("user_id");
  if (error) throw new Error(error.message);

  const results: Record<string, QueueResult> = {};
  for (const owner of owners ?? []) {
    results[owner.user_id] = await syncBrokerOrders(owner.user_id);
  }
  return results;
}

/** Hands this owner's queued orders to their bridge and marks them claimed. */
export async function claimOrders(ownerId: string, limit: number) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("broker_orders")
    .select("*")
    .eq("user_id", ownerId)
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(Math.min(Math.max(limit, 1), 50));
  if (error) throw new Error(error.message);
  const orders = data ?? [];
  if (orders.length > 0) {
    await supabaseAdmin
      .from("broker_orders")
      .update({ status: "claimed", claimed_at: new Date().toISOString() })
      .eq("user_id", ownerId)
      .in(
        "id",
        orders.map((o) => o.id),
      );
  }
  return orders;
}

export interface FillReport {
  id: string;
  status: "filled" | "rejected" | "skipped";
  broker_symbol?: string | null;
  broker_ticket?: string | null;
  filled_price?: number | null;
  filled_volume?: number | null;
  error?: string | null;
}

/** Records what this owner's demo terminal did with each claimed order. */
export async function recordFills(ownerId: string, reports: FillReport[]) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let updated = 0;
  for (const r of reports) {
    const { error } = await supabaseAdmin
      .from("broker_orders")
      .update({
        status: r.status,
        broker_symbol: r.broker_symbol ?? null,
        broker_ticket: r.broker_ticket ?? null,
        filled_price: r.filled_price ?? null,
        filled_volume: r.filled_volume ?? null,
        filled_at: r.status === "filled" ? new Date().toISOString() : null,
        error: r.error ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", r.id)
      .eq("user_id", ownerId);
    if (!error) updated++;
  }
  return updated;
}

export interface Heartbeat {
  bridge_version?: string | null;
  account_login?: string | null;
  account_server?: string | null;
  account_is_demo?: boolean | null;
  balance?: number | null;
  equity?: number | null;
  currency?: string | null;
  open_positions?: number | null;
  note?: string | null;
}

export async function recordHeartbeat(ownerId: string, hb: Heartbeat) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("broker_bridge_heartbeats").insert({
    user_id: ownerId,
    seen_at: new Date().toISOString(),
    ...hb,
  } as never);
}
