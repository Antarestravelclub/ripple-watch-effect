// The signed-in owner's bridge setup values, used by the Bridge page.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface BridgeConfigView {
  secret: string;
  allowedAccount: string | null;
  rotatedAt: string;
  /** Broker server name last reported by the helper, when it has run. */
  brokerServer?: string | null;
  /** Fixed values the helper expects; shown read-only on the page. */
  executionEnabled: false;
  maxLotsPerOrder: number;
  accountPostIntervalS: number;
  dealsPostIntervalS: number;
  instructionPollIntervalS: number;
}

const FIXED = {
  executionEnabled: false as const,
  maxLotsPerOrder: 10.0,
  accountPostIntervalS: 45,
  dealsPostIntervalS: 60,
  instructionPollIntervalS: 12,
};

export const getBridgeConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BridgeConfigView> => {
    const { ensureBridgeSecret } = await import("./bridge-secret.server");
    const row = await ensureBridgeSecret(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: hb } = await supabaseAdmin
      .from("broker_bridge_heartbeats")
      .select("account_server")
      .eq("user_id", context.userId)
      .order("seen_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return {
      secret: row.secret,
      allowedAccount: row.allowedAccount,
      rotatedAt: row.rotatedAt,
      brokerServer: hb?.account_server ?? null,
      ...FIXED,
    };
  });

export const regenerateBridgeSecret = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BridgeConfigView> => {
    const { rotateBridgeSecret } = await import("./bridge-secret.server");
    const row = await rotateBridgeSecret(context.userId);
    return {
      secret: row.secret,
      allowedAccount: row.allowedAccount,
      rotatedAt: row.rotatedAt,
      ...FIXED,
    };
  });

export const setAllowedAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { allowedAccount: string }) => {
    const raw = String(d.allowedAccount ?? "").trim();
    if (raw && !/^\d{4,12}$/.test(raw)) {
      throw new Error("Enter the account login number shown in MT5 (digits only)");
    }
    return { allowedAccount: raw };
  })
  .handler(async ({ data, context }) => {
    const { ensureBridgeSecret } = await import("./bridge-secret.server");
    await ensureBridgeSecret(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("bridge_secrets")
      .update({ allowed_account: data.allowedAccount || null })
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true, allowedAccount: data.allowedAccount || null };
  });
