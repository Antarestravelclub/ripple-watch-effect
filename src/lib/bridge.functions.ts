// Client-callable server functions for the Demo Account panel and mirroring.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface DemoPosition {
  ticket: number;
  symbol: string;
  direction: "long" | "short";
  lots: number | null;
  open_price: number | null;
  current_price: number | null;
  sl: number | null;
  tp: number | null;
  profit: number | null;
  open_time: string | null;
}

export interface DemoDeal {
  deal_id: number;
  symbol: string;
  direction: string | null;
  lots: number | null;
  open_price: number | null;
  close_price: number | null;
  profit: number | null;
  commission: number | null;
  swap: number | null;
  close_time: string | null;
}

export interface MirrorInstruction {
  id: string;
  paper_trade_id: string | null;
  action: string;
  broker_symbol: string;
  direction: string;
  lots: number | null;
  status: string;
  status_detail: string | null;
  fill_price: number | null;
  fill_time: string | null;
  filled_ticket: number | null;
  created_at: string;
  picked_up_at: string | null;
  expires_at: string;
}

/** Everything the Demo Account panel renders. */
export const getDemoAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { bridgeState, expireInstructions } = await import("@/lib/bridge-mirror.server");

    await expireInstructions();
    const state = await bridgeState();

    const [{ data: positions }, { data: deals }, { data: instructions }] = await Promise.all([
      supabaseAdmin
        .from("bridge_positions")
        .select("*")
        .eq("status", "open")
        .order("open_time", { ascending: false }),
      supabaseAdmin
        .from("bridge_deals")
        .select("*")
        .order("close_time", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("bridge_instructions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    const snap = state.snapshot as
      | {
          account_number: string;
          account_mode: string;
          currency: string | null;
          balance: number | null;
          equity: number | null;
          margin: number | null;
          free_margin: number | null;
          received_at: string;
        }
      | null;

    const open = (positions ?? []) as unknown as DemoPosition[];
    const floating = open.reduce((sum, p) => sum + (p.profit ?? 0), 0);

    return {
      status: state.status,
      lastSeen: snap?.received_at ?? null,
      account: snap
        ? {
            masked: `••••${snap.account_number.slice(-3)}`,
            mode: snap.account_mode,
            currency: snap.currency,
            balance: snap.balance,
            equity: snap.equity,
            margin: snap.margin,
            freeMargin: snap.free_margin,
          }
        : null,
      floatingPnl: open.length > 0 ? floating : null,
      positions: open,
      deals: (deals ?? []) as unknown as DemoDeal[],
      instructions: (instructions ?? []) as unknown as MirrorInstruction[],
      mirroringPaused: state.mirroringPaused,
      maxLotsPerTrade: state.maxLotsPerTrade,
    };
  });

/** Kill switch: pausing also cancels anything still waiting. */
export const setMirroringPaused = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { paused: boolean }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { bridgeState } = await import("@/lib/bridge-mirror.server");
    const state = await bridgeState();

    if (state.settingsId) {
      const { error } = await supabaseAdmin
        .from("bridge_mirror_settings")
        .update({ mirroring_paused: data.paused } as never)
        .eq("id", state.settingsId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("bridge_mirror_settings")
        .insert({ mirroring_paused: data.paused } as never);
      if (error) throw new Error(error.message);
    }

    let cancelled = 0;
    if (data.paused) {
      const { data: rows } = await supabaseAdmin
        .from("bridge_instructions")
        .update({
          status: "cancelled",
          status_detail: "Cancelled: mirroring was paused.",
        } as never)
        .in("status", ["pending", "picked_up"])
        .select("id");
      cancelled = (rows ?? []).length;
    }
    return { paused: data.paused, cancelled };
  });

/** Mirror one of the signed-in user's own open paper trades to the demo account. */
export const mirrorPaperTrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { paperTradeId: string; lots: number }) => d)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createOpenInstruction } = await import("@/lib/bridge-mirror.server");

    const { data: trade } = await supabaseAdmin
      .from("paper_trades")
      .select("id,ticker,direction,status,stop_price,target_price")
      .eq("id", data.paperTradeId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!trade) throw new Error("Paper trade not found");
    if (trade.status !== "open") throw new Error("This paper trade is already closed");

    return createOpenInstruction({
      paperTradeId: trade.id,
      ticker: trade.ticker,
      direction: trade.direction as "long" | "short",
      lots: Number(data.lots),
      stop: trade.stop_price != null ? Number(trade.stop_price) : null,
      target: trade.target_price != null ? Number(trade.target_price) : null,
    });
  });
