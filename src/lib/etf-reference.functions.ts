// ETF reference universe: public read + admin maintenance.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { EtfReferenceRow } from "./instrument";

const CATEGORIES = ["sector", "country", "commodity", "broad_market", "bond", "currency"] as const;

/** Whole reference list, readable by anyone (used for badges and filters). */
export const listEtfReference = createServerFn({ method: "GET" }).handler(async () => {
  const { allEtfRows } = await import("./etf-reference.server");
  const rows = await allEtfRows();
  return { rows };
});


const upsertSchema = z.object({
  ticker: z.string().min(1).max(12),
  name: z.string().min(1),
  category: z.enum(CATEGORIES),
  theme_keywords: z.array(z.string().min(2)).max(40),
  leveraged: z.boolean().default(false),
  inverse: z.boolean().default(false),
  active: z.boolean().default(true),
});

export const upsertEtfReference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => upsertSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (isAdmin !== true) throw new Error("Admins only");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("etf_reference").upsert(
      {
        ticker: data.ticker.toUpperCase(),
        name: data.name,
        category: data.category,
        theme_keywords: data.theme_keywords.map((k) => k.toLowerCase()),
        leveraged: data.leveraged,
        inverse: data.inverse,
        active: data.active,
      },
      { onConflict: "ticker" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setEtfActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ticker: z.string(), active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (isAdmin !== true) throw new Error("Admins only");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("etf_reference")
      .update({ active: data.active })
      .eq("ticker", data.ticker.toUpperCase());
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Feed check: every suggestable fund must return a live quote and enough daily
 * history for ATR. Failures are deactivated with the reason recorded, so a
 * broken symbol can never reach a signal.
 */
export const verifyEtfFeeds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (isAdmin !== true) throw new Error("Admins only");

    const { allEtfRows } = await import("./etf-reference.server");
    const { fetchQuoteWithRetry } = await import("./quotes.server");
    const { atrFor } = await import("./atr.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const rows = (await allEtfRows()).filter((r) => !r.leveraged && !r.inverse);
    const report: Array<{ ticker: string; ok: boolean; price: number | null; atr: number | null; error: string | null }> =
      [];

    for (const row of rows) {
      let error: string | null = null;
      let price: number | null = null;
      let atr: number | null = null;
      try {
        const q = await fetchQuoteWithRetry(row.ticker);
        if (q.status !== "ok") error = q.message ?? q.status;
        else price = q.price;
        if (!error) {
          atr = await atrFor(row.ticker);
          if (atr == null) error = "insufficient daily history for ATR";
        }
      } catch (e) {
        error = e instanceof Error ? e.message : "quote failed";
      }
      await supabaseAdmin
        .from("etf_reference")
        .update({ feed_error: error, active: error == null })
        .eq("ticker", row.ticker);
      report.push({ ticker: row.ticker, ok: error == null, price, atr, error });
    }

    return {
      checked: report.length,
      failed: report.filter((r) => !r.ok).length,
      report,
    };
  });

export type EtfRow = EtfReferenceRow;
