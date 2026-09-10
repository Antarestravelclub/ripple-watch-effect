import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listSignalsForEvent } from "@/lib/signals.functions";
import { useLiveQuotes } from "@/hooks/use-live-quotes";
import { tickerMeta } from "@/lib/ticker-registry";
import { rankOpportunities, fmtPrice } from "@/lib/opportunity";
import { TickerLabel } from "./ticker-meta-chips";

/**
 * Top 3 exposed names for an event, ranked by modelled upside to target.
 * Levels are the stored paper-research levels (ATR-scaled) — not advice.
 */
export function TopOpportunities({
  eventId,
  limit = 3,
  compact = false,
}: {
  eventId: string;
  limit?: number;
  compact?: boolean;
}) {
  const fetcher = useServerFn(listSignalsForEvent);
  const { data } = useSuspenseQuery({
    queryKey: ["signals", "event", eventId],
    queryFn: () => fetcher({ data: { eventId } }),
    staleTime: 60_000,
  });
  const top = rankOpportunities(data.signals ?? [], limit);
  const { quotes } = useLiveQuotes(
    top.map((o) => o.signal.quote_symbol || tickerMeta(o.signal.ticker).quote),
  );
  if (top.length === 0) return null;

  return (
    <div className="mt-3 rounded-lg border border-border/60 bg-background/40 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/50">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
          Top {top.length} exposed names · ranked by modelled upside
        </span>
        {!compact && (
          <span className="ml-auto text-[10px] text-muted-foreground">
            Paper levels only — not advice
          </span>
        )}
      </div>
      <table className="w-full text-[11px]">
        <thead className="text-muted-foreground">
          <tr className="[&>th]:px-2 [&>th]:py-1 [&>th]:font-medium [&>th]:text-left">
            <th>Ticker</th>
            <th className="text-right">Entry</th>
            <th className="text-right">Now</th>
            <th className="text-right">Target</th>
            <th className="text-right">Exit</th>
            <th className="text-right">Upside</th>
            <th className="text-right">R:R</th>
          </tr>
        </thead>
        <tbody className="font-mono tabular-nums">
          {top.map((o) => {
            const sym = o.signal.quote_symbol || tickerMeta(o.signal.ticker).quote;
            const now = quotes[sym]?.price ?? data.latest[o.signal.id]?.price ?? null;
            const long = o.signal.direction === "long";
            return (
              <tr
                key={o.signal.id}
                className="border-t border-border/40 [&>td]:px-2 [&>td]:py-1"
              >
                <td className="flex items-center gap-1.5">
                  <span
                    className={
                      "px-1 rounded border text-[9px] " +
                      (long
                        ? "bg-tailwind/15 text-tailwind border-tailwind/30"
                        : "bg-headwind/15 text-headwind border-headwind/30")
                    }
                  >
                    {long ? "LONG" : "SHORT"}
                  </span>
                  <TickerLabel ticker={o.signal.ticker} showAlt={false} />
                </td>
                <td className="text-right">{fmtPrice(o.entry)}</td>
                <td className="text-right text-muted-foreground">
                  {now != null ? fmtPrice(now) : "—"}
                </td>
                <td className="text-right text-tailwind">{fmtPrice(o.target)}</td>
                <td className="text-right text-headwind">
                  {o.exit != null ? fmtPrice(o.exit) : "—"}
                </td>
                <td className="text-right font-semibold text-tailwind">
                  +{o.upsidePct.toFixed(1)}%
                </td>
                <td className="text-right text-muted-foreground">
                  {o.rr != null ? `${o.rr.toFixed(1)}×` : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
