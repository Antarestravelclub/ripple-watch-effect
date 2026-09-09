import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

/** Read-only monitoring view of the signed-in owner's demo-account pipeline. */
export const getBrokerActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [ordersRes, hbRes, secretRes] = await Promise.all([
      supabaseAdmin
        .from("broker_orders")
        .select("*")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(100),
      supabaseAdmin
        .from("broker_bridge_heartbeats")
        .select("*")
        .eq("user_id", context.userId)
        .order("seen_at", { ascending: false })
        .limit(1),
      supabaseAdmin
        .from("bridge_secrets")
        .select("user_id")
        .eq("user_id", context.userId)
        .maybeSingle(),
    ]);

    const orders = (ordersRes.data ?? []) as unknown as BrokerOrderRow[];
    const counts = orders.reduce<Record<string, number>>((acc, o) => {
      acc[o.status] = (acc[o.status] ?? 0) + 1;
      return acc;
    }, {});

    const heartbeat = ((hbRes.data ?? [])[0] ?? null) as unknown as BridgeHeartbeatRow | null;

    const uploadRes = await supabaseAdmin
      .from("broker_symbol_uploads")
      .select("id, created_at, symbol_count")
      .order("created_at", { ascending: false })
      .limit(1);
    const upload = ((uploadRes.data ?? [])[0] ?? null) as
      | { created_at: string; symbol_count: number | null }
      | null;

    return {
      configured: Boolean(secretRes.data),
      orders,
      counts,
      heartbeat,
      heartbeatFresh: heartbeat
        ? Date.now() - new Date(heartbeat.seen_at).getTime() < 10 * 60_000
        : false,
      symbolUpload: upload,
    };
  });
