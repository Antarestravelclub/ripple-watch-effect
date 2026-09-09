// Server-only ingestion of MetaTrader 5 *demo* account state reported by the
// Windows bridge helper: account snapshots, open positions and closed deals.
import { z } from "zod";

const numberish = z.union([z.number(), z.string()]).nullish().transform((v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
});

const timeish = z.union([z.string(), z.number()]).nullish().transform((v) => {
  if (v === null || v === undefined || v === "") return null;
  const d = typeof v === "number" ? new Date(v * 1000) : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
});

export const accountSchema = z.object({
  account_number: z.union([z.string(), z.number()]).transform(String),
  account_mode: z.enum(["demo", "live"]),
  currency: z.string().max(16).nullish(),
  balance: numberish,
  equity: numberish,
  margin: numberish,
  free_margin: numberish,
});

export const positionSchema = z.object({
  ticket: z.union([z.number(), z.string()]).transform((v) => Number(v)),
  symbol: z.string().min(1).max(64),
  direction: z.enum(["long", "short"]),
  lots: numberish,
  open_price: numberish,
  sl: numberish,
  tp: numberish,
  current_price: numberish,
  profit: numberish,
  open_time: timeish,
});

export const dealSchema = z.object({
  deal_id: z.union([z.number(), z.string()]).transform((v) => Number(v)),
  ticket: z.union([z.number(), z.string()]).nullish().transform((v) => (v === null || v === undefined || v === "" ? null : Number(v))),
  symbol: z.string().min(1).max(64),
  direction: z.enum(["long", "short"]).nullish(),
  lots: numberish,
  open_price: numberish,
  close_price: numberish,
  profit: numberish,
  commission: numberish,
  swap: numberish,
  open_time: timeish,
  close_time: timeish,
});

export async function recordAccountSnapshot(input: unknown) {
  const data = accountSchema.parse(input);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("bridge_account_snapshots").insert({
    account_number: data.account_number,
    account_mode: data.account_mode,
    currency: data.currency ?? null,
    balance: data.balance,
    equity: data.equity,
    margin: data.margin,
    free_margin: data.free_margin,
  } as never);
  if (error) throw new Error(error.message);

  if (data.account_mode === "live") {
    // Defense in depth: a live terminal must never leave pending work behind.
    await supabaseAdmin
      .from("bridge_instructions")
      .update({
        status: "cancelled",
        status_detail: "Cancelled: reporting terminal is a live account.",
      } as never)
      .in("status", ["pending", "picked_up"]);
  }
  return { mode: data.account_mode };
}

export async function syncPositions(input: unknown) {
  const positions = z.array(positionSchema).max(500).parse(input);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const seenAt = new Date().toISOString();

  if (positions.length > 0) {
    const { error } = await supabaseAdmin.from("bridge_positions").upsert(
      positions.map((p) => ({
        ticket: p.ticket,
        symbol: p.symbol,
        direction: p.direction,
        lots: p.lots,
        open_price: p.open_price,
        sl: p.sl,
        tp: p.tp,
        current_price: p.current_price,
        profit: p.profit,
        open_time: p.open_time,
        last_seen_at: seenAt,
        status: "open",
      })) as never,
      { onConflict: "ticket" },
    );
    if (error) throw new Error(error.message);
  }

  // Anything previously open but absent from this full snapshot is closed.
  const tickets = positions.map((p) => p.ticket);
  let closeQuery = supabaseAdmin
    .from("bridge_positions")
    .update({ status: "closed" } as never)
    .eq("status", "open");
  if (tickets.length > 0) closeQuery = closeQuery.not("ticket", "in", `(${tickets.join(",")})`);
  const { error: closeError } = await closeQuery;
  if (closeError) throw new Error(closeError.message);

  return { open: positions.length };
}

export async function syncDeals(input: unknown) {
  const deals = z.array(dealSchema).max(500).parse(input);
  if (deals.length === 0) return { inserted: 0 };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Insert-if-new keyed on deal_id, so repeated posts are harmless.
  const { data, error } = await supabaseAdmin
    .from("bridge_deals")
    .upsert(
      deals.map((d) => ({
        deal_id: d.deal_id,
        ticket: d.ticket,
        symbol: d.symbol,
        direction: d.direction ?? null,
        lots: d.lots,
        open_price: d.open_price,
        close_price: d.close_price,
        profit: d.profit,
        commission: d.commission,
        swap: d.swap,
        open_time: d.open_time,
        close_time: d.close_time,
      })) as never,
      { onConflict: "deal_id", ignoreDuplicates: true },
    )
    .select("deal_id");
  if (error) throw new Error(error.message);

  await reconcileDemoCloses(deals.map((d) => d.ticket).filter((t): t is number => t !== null));
  return { inserted: (data ?? []).length };
}

/** Fold demo closes back onto the mirrored paper trades. */
export async function reconcileDemoCloses(tickets: number[]) {
  if (tickets.length === 0) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: trades } = await supabaseAdmin
    .from("paper_trades")
    .select("id, mirror_ticket")
    .in("mirror_ticket", tickets);

  for (const trade of (trades ?? []) as { id: string; mirror_ticket: number | null }[]) {
    if (trade.mirror_ticket === null) continue;
    const { data: deals } = await supabaseAdmin
      .from("bridge_deals")
      .select("close_price, profit, commission, swap, close_time")
      .eq("ticket", trade.mirror_ticket)
      .order("close_time", { ascending: false });
    const rows = (deals ?? []) as {
      close_price: number | null;
      profit: number | null;
      commission: number | null;
      swap: number | null;
    }[];
    if (rows.length === 0) continue;
    const net = rows.reduce(
      (sum, r) => sum + (r.profit ?? 0) + (r.commission ?? 0) + (r.swap ?? 0),
      0,
    );
    const closePrice = rows.find((r) => r.close_price !== null)?.close_price ?? null;
    await supabaseAdmin
      .from("paper_trades")
      .update({ demo_close_price: closePrice, demo_realized_pnl: net } as never)
      .eq("id", trade.id);
  }
}
