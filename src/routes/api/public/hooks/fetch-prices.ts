// Scheduled endpoint: fetches quotes for every open signal's ticker,
// appends price_snapshots, and closes signals that touched their target or
// invalidation level.
import { createFileRoute } from "@tanstack/react-router";

async function fetchQuote(ticker: string, apiKey: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(ticker)}&token=${apiKey}`,
    );
    if (!res.ok) return null;
    const j = (await res.json()) as { c?: number };
    if (typeof j.c === "number" && j.c > 0) return j.c;
    return null;
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/public/hooks/fetch-prices")({
  server: {
    handlers: {
      POST: async () => {
        const apiKey = process.env.FINNHUB_API_KEY;
        if (!apiKey) {
          return new Response(
            JSON.stringify({ ok: false, error: "FINNHUB_API_KEY not set" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: openSignals, error } = await supabaseAdmin
          .from("signals")
          .select("id,ticker,direction,signal_price,target_price,invalidation_price,status")
          .eq("status", "open");
        if (error) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const tickers = Array.from(new Set((openSignals ?? []).map((s) => s.ticker)));
        const priceByTicker = new Map<string, number>();
        for (const t of tickers) {
          const p = await fetchQuote(t, apiKey);
          if (p != null) priceByTicker.set(t, p);
        }

        const inserts: Array<{ signal_id: string; ticker: string; price: number }> = [];
        const updates: Array<{
          id: string;
          patch: Record<string, unknown>;
        }> = [];
        for (const s of openSignals ?? []) {
          const price = priceByTicker.get(s.ticker);
          if (price == null) continue;
          inserts.push({ signal_id: s.id, ticker: s.ticker, price });

          // Backfill signal_price + levels if missing
          if (s.signal_price == null) {
            const levels =
              s.direction === "long"
                ? { target: price * 1.1, invalidation: price * 0.92 }
                : { target: price * 0.9, invalidation: price * 1.08 };
            updates.push({
              id: s.id,
              patch: {
                signal_price: price,
                target_price: +levels.target.toFixed(4),
                invalidation_price: +levels.invalidation.toFixed(4),
              },
            });
            continue;
          }

          // Close-conditions
          const hitTarget =
            s.target_price != null &&
            (s.direction === "long"
              ? price >= Number(s.target_price)
              : price <= Number(s.target_price));
          const hitInv =
            s.invalidation_price != null &&
            (s.direction === "long"
              ? price <= Number(s.invalidation_price)
              : price >= Number(s.invalidation_price));
          if (hitTarget || hitInv) {
            updates.push({
              id: s.id,
              patch: {
                status: "closed",
                closed_price: price,
                closed_at: new Date().toISOString(),
                close_reason: hitTarget ? "target" : "invalidation",
              },
            });
          }
        }

        if (inserts.length > 0) {
          await supabaseAdmin.from("price_snapshots").insert(inserts);
        }
        for (const u of updates) {
          await supabaseAdmin.from("signals").update(u.patch).eq("id", u.id);
        }

        return new Response(
          JSON.stringify({
            ok: true,
            tickers: tickers.length,
            snapshots: inserts.length,
            closed: updates.filter((u) => u.patch.status === "closed").length,
            backfilled: updates.filter((u) => u.patch.signal_price != null).length,
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
