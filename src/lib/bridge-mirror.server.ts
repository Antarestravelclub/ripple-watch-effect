// Server-only mirroring layer: turns paper trades into demo-account
// instructions for the MetaTrader 5 bridge helper. Demo only, opt-in per trade.
const CONNECTED_MS = 2 * 60_000;

export type MirrorGuard = { ok: true; brokerSymbol: string } | { ok: false; reason: string };

export async function bridgeState() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: snaps }, { data: settings }] = await Promise.all([
    supabaseAdmin
      .from("bridge_account_snapshots")
      .select("*")
      .order("received_at", { ascending: false })
      .limit(1),
    supabaseAdmin.from("bridge_mirror_settings").select("*").limit(1),
  ]);
  const snapshot = (snaps ?? [])[0] ?? null;
  const setting = (settings ?? [])[0] ?? null;
  const ageMs = snapshot ? Date.now() - new Date(snapshot.received_at).getTime() : null;
  const status: "connected" | "stale" | "offline" =
    ageMs == null || ageMs > 10 * 60_000 ? "offline" : ageMs > CONNECTED_MS ? "stale" : "connected";
  return {
    snapshot,
    status,
    ageMs,
    mirroringPaused: setting?.mirroring_paused ?? true,
    maxLotsPerTrade: Number(setting?.max_lots_per_trade ?? 10),
    settingsId: setting?.id ?? null,
  };
}

/** Every rule from the mirroring spec. All must pass or no instruction is created. */
export async function guardMirror(ticker: string, lots: number): Promise<MirrorGuard> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const state = await bridgeState();

  if (state.status !== "connected") {
    return {
      ok: false,
      reason: `The demo bridge is ${state.status}. Start the helper and wait for it to check in before mirroring.`,
    };
  }
  if (state.snapshot?.account_mode !== "demo") {
    return { ok: false, reason: "Mirroring is refused: the connected terminal is not a demo account." };
  }
  if (state.mirroringPaused) {
    return { ok: false, reason: "Mirroring is paused. Switch off the pause in the Demo Account panel first." };
  }
  if (!(lots > 0)) return { ok: false, reason: "Lots must be greater than zero." };
  if (lots > state.maxLotsPerTrade) {
    return { ok: false, reason: `Lots must be ${state.maxLotsPerTrade} or fewer per mirrored trade.` };
  }

  const { data: latestUpload } = await supabaseAdmin
    .from("broker_symbol_uploads")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!latestUpload) {
    return { ok: false, reason: "Upload your broker's symbol list first — map this symbol first." };
  }

  const { data: match } = await supabaseAdmin
    .from("broker_symbols")
    .select("broker_symbol, mapping_status, trade_mode")
    .eq("upload_id", latestUpload.id)
    .eq("mapped_app_ticker", ticker.toUpperCase())
    .in("mapping_status", ["auto_mapped", "manual_mapped"])
    .limit(1)
    .maybeSingle();

  if (!match) {
    return { ok: false, reason: `${ticker} has no confirmed broker symbol — map this symbol first.` };
  }
  const mode = (match.trade_mode ?? "").toUpperCase();
  if (mode && !mode.includes("FULL")) {
    return {
      ok: false,
      reason: `${match.broker_symbol} is not fully tradable on this account (${match.trade_mode}).`,
    };
  }
  return { ok: true, brokerSymbol: match.broker_symbol };
}

export async function createOpenInstruction(args: {
  paperTradeId: string;
  ticker: string;
  direction: "long" | "short";
  lots: number;
  stop: number | null;
  target: number | null;
}) {
  const guard = await guardMirror(args.ticker, args.lots);
  if (!guard.ok) throw new Error(guard.reason);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: existing } = await supabaseAdmin
    .from("bridge_instructions")
    .select("id,status")
    .eq("paper_trade_id", args.paperTradeId)
    .eq("action", "open")
    .not("status", "in", "(rejected,cancelled,expired)")
    .limit(1)
    .maybeSingle();
  if (existing) throw new Error("This paper trade is already mirrored to the demo account.");

  const { data, error } = await supabaseAdmin
    .from("bridge_instructions")
    .insert({
      paper_trade_id: args.paperTradeId,
      action: "open",
      broker_symbol: guard.brokerSymbol,
      direction: args.direction,
      lots: args.lots,
      sl: args.stop,
      tp: args.target,
    } as never)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { id: (data as { id: string } | null)?.id ?? null, brokerSymbol: guard.brokerSymbol };
}

/** Called when a mirrored paper trade closes (manually or by the cron). */
export async function createCloseInstruction(paperTradeId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: trade } = await supabaseAdmin
    .from("paper_trades")
    .select("id,ticker,direction,mirrored,mirror_ticket")
    .eq("id", paperTradeId)
    .maybeSingle();
  const t = trade as
    | { ticker: string; direction: string; mirrored: boolean; mirror_ticket: number | null }
    | null;
  if (!t || !t.mirrored || t.mirror_ticket == null) return null;

  const { data: dup } = await supabaseAdmin
    .from("bridge_instructions")
    .select("id")
    .eq("paper_trade_id", paperTradeId)
    .eq("action", "close")
    .not("status", "in", "(rejected,cancelled,expired)")
    .limit(1)
    .maybeSingle();
  if (dup) return null;

  const { data: open } = await supabaseAdmin
    .from("bridge_instructions")
    .select("broker_symbol")
    .eq("paper_trade_id", paperTradeId)
    .eq("action", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabaseAdmin
    .from("bridge_instructions")
    .insert({
      paper_trade_id: paperTradeId,
      action: "close",
      broker_symbol: (open as { broker_symbol: string } | null)?.broker_symbol ?? t.ticker,
      direction: t.direction,
      ticket: t.mirror_ticket,
    } as never)
    .select("id")
    .maybeSingle();
  if (error) {
    console.warn(`[mirror] could not queue close for ${paperTradeId}: ${error.message}`);
    return null;
  }
  return (data as { id: string } | null)?.id ?? null;
}

/** Helper poll: hand over pending work and mark it picked up. */
export async function claimInstructions(limit = 10) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await expireInstructions();

  const { data: pending } = await supabaseAdmin
    .from("bridge_instructions")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(Math.min(Math.max(limit, 1), 50));
  const rows = (pending ?? []) as { id: string }[];
  if (rows.length === 0) return [];

  await supabaseAdmin
    .from("bridge_instructions")
    .update({ status: "picked_up", picked_up_at: new Date().toISOString() } as never)
    .in(
      "id",
      rows.map((r) => r.id),
    )
    .eq("status", "pending");

  return rows;
}

/** Idempotent result report from the helper. */
export async function recordInstructionResult(
  id: string,
  input: {
    status: "filled" | "rejected";
    fill_price?: number | null;
    fill_time?: string | null;
    ticket?: number | null;
    detail?: string | null;
  },
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: instruction } = await supabaseAdmin
    .from("bridge_instructions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  const ins = instruction as
    | {
        id: string;
        status: string;
        action: string;
        paper_trade_id: string | null;
      }
    | null;
  if (!ins) throw new Error("Unknown instruction id");

  // Already terminal — accept and change nothing.
  if (["filled", "rejected", "cancelled", "expired"].includes(ins.status)) {
    return { ok: true, unchanged: true, status: ins.status };
  }

  const fillTime = input.fill_time ?? new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("bridge_instructions")
    .update({
      status: input.status,
      status_detail: input.detail ?? null,
      fill_price: input.fill_price ?? null,
      fill_time: input.status === "filled" ? fillTime : null,
      filled_ticket: input.ticket ?? null,
    } as never)
    .eq("id", id)
    .in("status", ["pending", "picked_up"]);
  if (error) throw new Error(error.message);

  if (input.status === "filled" && ins.paper_trade_id) {
    if (ins.action === "open") {
      await supabaseAdmin
        .from("paper_trades")
        .update({
          mirrored: true,
          mirror_ticket: input.ticket ?? null,
          demo_fill_price: input.fill_price ?? null,
        } as never)
        .eq("id", ins.paper_trade_id);
    } else if (input.fill_price != null) {
      await supabaseAdmin
        .from("paper_trades")
        .update({ demo_close_price: input.fill_price } as never)
        .eq("id", ins.paper_trade_id);
    }
  }
  return { ok: true, unchanged: false, status: input.status };
}

/** Anything past its expiry and still waiting is expired, never silently dropped. */
export async function expireInstructions() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("bridge_instructions")
    .update({
      status: "expired",
      status_detail: "Not picked up by the helper within 10 minutes.",
    } as never)
    .in("status", ["pending", "picked_up"])
    .lt("expires_at", new Date().toISOString())
    .select("id");
  return (data ?? []).length;
}
