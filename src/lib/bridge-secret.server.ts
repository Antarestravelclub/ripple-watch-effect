// Per-owner bridge secrets. Each signed-in owner holds one long random secret
// which their local MT5 helper sends on every /api/public/bridge/* request.
import { randomBytes } from "crypto";

export interface BridgeSecretRow {
  userId: string;
  secret: string;
  allowedAccount: string | null;
  rotatedAt: string;
}

/** 64 hex chars — long enough that guessing is hopeless. */
export function newBridgeSecret(): string {
  return randomBytes(32).toString("hex");
}

/** Reads the owner's secret, minting one on first use. */
export async function ensureBridgeSecret(userId: string): Promise<BridgeSecretRow> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("bridge_secrets")
    .select("user_id,secret,allowed_account,rotated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (data) {
    return {
      userId: data.user_id,
      secret: data.secret,
      allowedAccount: data.allowed_account,
      rotatedAt: data.rotated_at,
    };
  }
  const secret = newBridgeSecret();
  const { data: created, error } = await supabaseAdmin
    .from("bridge_secrets")
    .insert({ user_id: userId, secret })
    .select("user_id,secret,allowed_account,rotated_at")
    .single();
  if (error || !created) throw new Error(error?.message ?? "Could not create a bridge secret");
  return {
    userId: created.user_id,
    secret: created.secret,
    allowedAccount: created.allowed_account,
    rotatedAt: created.rotated_at,
  };
}

/** Rotates the secret; the old value stops working the moment this returns. */
export async function rotateBridgeSecret(userId: string): Promise<BridgeSecretRow> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await ensureBridgeSecret(userId);
  const secret = newBridgeSecret();
  const { data, error } = await supabaseAdmin
    .from("bridge_secrets")
    .update({ secret, rotated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .select("user_id,secret,allowed_account,rotated_at")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not rotate the bridge secret");
  return {
    userId: data.user_id,
    secret: data.secret,
    allowedAccount: data.allowed_account,
    rotatedAt: data.rotated_at,
  };
}

/** Which owner does this presented secret belong to, if any? */
export async function ownerOfBridgeSecret(secret: string): Promise<string | null> {
  if (!secret) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("bridge_secrets")
    .select("user_id")
    .eq("secret", secret)
    .maybeSingle();
  return data?.user_id ?? null;
}
