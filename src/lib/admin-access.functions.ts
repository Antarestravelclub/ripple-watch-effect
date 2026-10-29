import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const requireAdminAccess = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ context, next }) => {
    const { data, error } = await context.supabase.rpc("has_admin_access");
    if (error || data !== true) throw new Error("Unlock admin access with your entry code first.");
    return next();
  });

export const getAdminAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: admin, error } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "admin",
    });
    if (error) throw new Error("Could not check admin access.");
    if (!admin) return { admin: false, unlocked: false };
    const { data: unlocked, error: accessError } = await context.supabase.rpc("has_admin_access");
    if (accessError) throw new Error("Could not check entry access.");
    return { admin: true, unlocked: unlocked === true };
  });

export const unlockAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ pin: z.string().regex(/^\d{4}$/) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: ok, error } = await context.supabase.rpc("verify_admin_pin", { p_pin: data.pin });
    if (error) throw new Error(error.message);
    if (!ok) throw new Error("Incorrect entry code.");
    return { ok: true };
  });

export const lockAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase.rpc("lock_admin_access");
    if (error) throw new Error("Could not lock admin access.");
    return { ok: true };
  });