import { createServerFn } from "@tanstack/react-start";

export interface BrokerOrderRow {
  id: string;
  signal_id: string;
  ticker: string;
  side: "buy" | "sell";
  intent: "open" | "close";
  status: "queued" | "claimed" | "filled" | "rejected" | "skipped";
  reference_price: number | null;
  stop_price: number | null;
  target_price: number | null;
  suggested_size_pct: number | null;
  conviction_score: number | null;
  broker_symbol: string | null;
  broker_ticket: string | null;
  filled_price: number | null;
  filled_volume: number | null;
  filled_at: string | null;
  error: string | null;
  created_at: string;
}

export interface BridgeHeartbeatRow {
  seen_at: string;
  bridge_version: string | null;
  account_login: string | null;
  account_server: string | null;
  account_is_demo: boolean | null;
  balance: number | null;
  equity: number | null;
  currency: string | null;
  open_positions: number | null;
  note: string | null;
}

/** Read-only monitoring view of the demo-account pipeline. */
export const getBrokerActivity = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [ordersRes, hbRes] = await Promise.all([
    supabaseAdmin
      .from("broker_orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
    supabaseAdmin
      .from("broker_bridge_heartbeats")
      .select("*")
      .order("seen_at", { ascending: false })
      .limit(1),
  ]);

  const orders = (ordersRes.data ?? []) as unknown as BrokerOrderRow[];
  const counts = orders.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1;
    return acc;
  }, {});

  return {
    configured: Boolean(process.env["BRIDGE_SECRET"]),
    orders,
    counts,
    heartbeat: ((hbRes.data ?? [])[0] ?? null) as unknown as BridgeHeartbeatRow | null,
  };
});
