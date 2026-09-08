// One-off/idempotent backfill: gives older signals an index entry price so
// their alpha is computable. Backfilled entries are marked estimated.
import { BENCHMARK_SYMBOL, benchmarkCloseAt } from "./benchmark.server";

export interface BackfillResult {
  scanned: number;
  entriesFilled: number;
  exitsFilled: number;
}

export async function backfillBenchmarks(limit = 500): Promise<BackfillResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const out: BackfillResult = { scanned: 0, entriesFilled: 0, exitsFilled: 0 };

  const { data: rows, error } = await supabaseAdmin
    .from("signals")
    .select("id,signal_timestamp,closed_at,status,benchmark_entry_price,benchmark_exit_price")
    .or("benchmark_entry_price.is.null,and(closed_at.not.is.null,benchmark_exit_price.is.null)")
    .limit(limit);
  if (error) throw new Error(error.message);

  for (const s of rows ?? []) {
    out.scanned++;
    const patch: {
      benchmark_symbol?: string;
      benchmark_entry_price?: number;
      benchmark_entry_estimated?: boolean;
      benchmark_source?: "backfilled_daily";
      benchmark_exit_price?: number;
    } = {};
    if (s.benchmark_entry_price == null) {
      const entry = await benchmarkCloseAt(s.signal_timestamp);
      if (entry != null) {
        patch.benchmark_symbol = BENCHMARK_SYMBOL;
        patch.benchmark_entry_price = entry;
        patch.benchmark_entry_estimated = true;
        patch.benchmark_source = "backfilled_daily";
        out.entriesFilled++;
      }
    }
    if (s.closed_at && s.benchmark_exit_price == null) {
      const exit = await benchmarkCloseAt(s.closed_at);
      if (exit != null) {
        patch.benchmark_exit_price = exit;
        // A daily-close exit makes the whole comparison approximate.
        patch.benchmark_source = "backfilled_daily";
        out.exitsFilled++;
      }
    }

    if (Object.keys(patch).length > 0) {
      await supabaseAdmin.from("signals").update(patch).eq("id", s.id);
    }
  }
  return out;
}
