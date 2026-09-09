// Server-side reads of the per-user paper account settings and the broker's
// minimum lot for a symbol. Server-only: never import from a component.
import {
  DEFAULT_PAPER_ACCOUNT,
  DEFAULT_MIN_LOT,
  type PaperAccountSettings,
} from "./paper-account";

/** The signed-in owner's paper account settings, or the documented defaults. */
export async function paperAccount(userId: string): Promise<PaperAccountSettings> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("paper_account_settings")
      .select("starting_balance,risk_per_trade_pct,max_position_pct,default_min_lot")
      .eq("user_id", userId)
      .maybeSingle();
    if (!data) return DEFAULT_PAPER_ACCOUNT;
    const balance = Number(data.starting_balance);
    return {
      startingBalance: balance > 0 ? balance : DEFAULT_PAPER_ACCOUNT.startingBalance,
      riskPerTradePct: Number(data.risk_per_trade_pct) || DEFAULT_PAPER_ACCOUNT.riskPerTradePct,
      maxPositionPct: Number(data.max_position_pct) || DEFAULT_PAPER_ACCOUNT.maxPositionPct,
      defaultMinLot: Number(data.default_min_lot) || DEFAULT_PAPER_ACCOUNT.defaultMinLot,
    };
  } catch {
    return DEFAULT_PAPER_ACCOUNT;
  }
}

export interface LotRule {
  minLot: number;
  lotStep: number;
  /** Where the numbers came from, so the UI can be honest about it. */
  source: "broker_upload" | "default";
  brokerSymbol: string | null;
}

/**
 * Minimum lot and lot step for an app ticker, from the latest broker symbol
 * upload when it carried volume columns, otherwise the account default.
 */
export async function lotRuleFor(ticker: string, fallbackMinLot: number): Promise<LotRule> {
  const fallback: LotRule = {
    minLot: fallbackMinLot > 0 ? fallbackMinLot : DEFAULT_MIN_LOT,
    lotStep: fallbackMinLot > 0 ? fallbackMinLot : DEFAULT_MIN_LOT,
    source: "default",
    brokerSymbol: null,
  };
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: upload } = await supabaseAdmin
      .from("broker_symbol_uploads")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!upload) return fallback;

    const { data } = await supabaseAdmin
      .from("broker_symbols")
      .select("broker_symbol,volume_min,volume_step")
      .eq("upload_id", upload.id)
      .eq("mapped_app_ticker", ticker.toUpperCase())
      .in("mapping_status", ["auto_mapped", "manual_mapped"])
      .limit(1)
      .maybeSingle();

    const min = data?.volume_min != null ? Number(data.volume_min) : null;
    if (!data || min == null || !(min > 0)) return fallback;
    const step = data.volume_step != null ? Number(data.volume_step) : null;
    return {
      minLot: min,
      lotStep: step && step > 0 ? step : min,
      source: "broker_upload",
      brokerSymbol: data.broker_symbol,
    };
  } catch {
    return fallback;
  }
}
