import { TickerChip } from "./ticker-chip";
import {
  ROLE_LABEL,
  formatPct,
  formatWindow,
  roleTone,
} from "@/lib/analogue-mapping";
import type { HistoricalReactionRow } from "@/lib/analogues.functions";

export function ReactionTable({ rows }: { rows: HistoricalReactionRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">
        No reactions recorded for this event.
      </p>
    );
  }
  const sorted = [...rows].sort((a, b) => {
    const order: Record<string, number> = {
      direct_winner: 0,
      substitute_winner: 1,
      second_order_winner: 2,
      direct_loser: 3,
      second_order_loser: 4,
    };
    return (order[a.role] ?? 99) - (order[b.role] ?? 99);
  });
  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted-foreground">
            <th className="text-left font-medium px-2 py-1.5">Ticker</th>
            <th className="text-left font-medium px-2 py-1.5">Role</th>
            <th className="text-right font-medium px-2 py-1.5">Move</th>
            <th className="text-right font-medium px-2 py-1.5">Window</th>
            <th className="text-right font-medium px-2 py-1.5">Status</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const tone: "tailwind" | "headwind" =
              r.direction === "up" ? "tailwind" : "headwind";
            const pctColor =
              r.direction === "up" ? "text-tailwind" : "text-headwind";
            return (
              <tr
                key={r.id}
                className="border-t border-border/40 align-middle"
              >
                <td className="px-2 py-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <TickerChip ticker={r.ticker} tone={tone} />
                    {r.company_name && (
                      <span className="text-muted-foreground truncate max-w-[140px]">
                        {r.company_name}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-2 py-1.5">
                  <span
                    className={
                      "inline-block text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border " +
                      roleTone(r.role)
                    }
                  >
                    {ROLE_LABEL[r.role]}
                  </span>
                </td>
                <td
                  className={
                    "px-2 py-1.5 text-right tabular-nums font-mono " + pctColor
                  }
                >
                  {formatPct(Number(r.pct_move))}
                </td>
                <td className="px-2 py-1.5 text-right text-muted-foreground">
                  {formatWindow(r.window_days)}
                </td>
                <td className="px-2 py-1.5 text-right">
                  {r.reverted ? (
                    <span className="inline-block text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full border border-border/60 bg-muted text-muted-foreground">
                      Reverted
                      {r.days_to_revert ? ` · ${formatWindow(r.days_to_revert)}` : ""}
                    </span>
                  ) : (
                    <span className="inline-block text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full border border-primary/30 bg-primary/5 text-primary">
                      Held
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
