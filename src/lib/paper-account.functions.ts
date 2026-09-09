// Read and update the signed-in owner's paper account settings.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DEFAULT_PAPER_ACCOUNT, type PaperAccountSettings } from "./paper-account";

export const getPaperAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PaperAccountSettings & { isDefault: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("paper_account_settings")
      .select("starting_balance,risk_per_trade_pct,max_position_pct,default_min_lot")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!data) return { ...DEFAULT_PAPER_ACCOUNT, isDefault: true };
    return {
      startingBalance: Number(data.starting_balance),
      riskPerTradePct: Number(data.risk_per_trade_pct),
      maxPositionPct: Number(data.max_position_pct),
      defaultMinLot: Number(data.default_min_lot),
      isDefault: false,
    };
  });

export const updatePaperAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      startingBalance: number;
      riskPerTradePct?: number;
      maxPositionPct?: number;
      defaultMinLot?: number;
    }) => {
      if (!(Number(d.startingBalance) > 0)) {
        throw new Error("Starting balance must be greater than zero");
      }
      if (Number(d.startingBalance) > 100_000_000) {
        throw new Error("Starting balance is unrealistically large");
      }
      for (const [k, v] of Object.entries({
        riskPerTradePct: d.riskPerTradePct,
        maxPositionPct: d.maxPositionPct,
        defaultMinLot: d.defaultMinLot,
      })) {
        if (v != null && !(Number(v) > 0)) throw new Error(`${k} must be greater than zero`);
      }
      return d;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("paper_account_settings").upsert(
      {
        user_id: context.userId,
        starting_balance: Number(data.startingBalance),
        risk_per_trade_pct: Number(data.riskPerTradePct ?? DEFAULT_PAPER_ACCOUNT.riskPerTradePct),
        max_position_pct: Number(data.maxPositionPct ?? DEFAULT_PAPER_ACCOUNT.maxPositionPct),
        default_min_lot: Number(data.defaultMinLot ?? DEFAULT_PAPER_ACCOUNT.defaultMinLot),
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
