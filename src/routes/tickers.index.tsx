import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell } from "@/components/site-shell";
import { useTickerRollups } from "@/hooks/use-ticker-rollups";
import { useLiveQuotes } from "@/hooks/use-live-quotes";
import {
  combinedMovePct,
  CONFLICT_NOTE,
  STANCE_CLASS,
  STANCE_LABEL,
} from "@/lib/ticker-rollup";
import { fmtPct, pctTone } from "@/lib/signal-metrics";
import { TickerLabel } from "@/components/ticker-meta-chips";

export const Route = createFileRoute("/tickers/")({
  head: () => ({
    meta: [
      { title: "Tickers — The Ripple Effect" },
      {
        name: "description",
        content:
          "Ticker-level rollup of active ripple signals: long vs short counts, net stance, and price move since the earliest snapshot.",
      },
      { property: "og:title", content: "Tickers — The Ripple Effect" },
      {
        property: "og:description",
        content:
          "Every ticker with an active signal, with conflicting exposures flagged. Educational research only.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TickersPage,
});

function TickersPage() {
  const { rows, isLoading } = useTickerRollups();
  const { quotes } = useLiveQuotes(rows.map((r) => r.quoteSymbol));

  return (
    <SiteShell>
      <div className="mb-4">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Tickers</h1>
        <p className="text-sm text-muted-foreground mt-1">
          One row per ticker with at least one active signal. Where events point in
          opposite directions on the same name, the stance is marked conflicted.
        </p>
        <p className="text-[11px] text-muted-foreground mt-1">
          Delayed prices. Educational research only — not investment advice.
        </p>
      </div>

      <div className="rounded-xl border border-border/70 bg-card/40 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-muted-foreground uppercase tracking-wider text-[10px]">
            <tr className="border-b border-border/60">
              <th className="text-left p-2">Ticker</th>
              <th className="text-right p-2">Active long</th>
              <th className="text-right p-2">Active short</th>
              <th className="text-left p-2">Net stance</th>
              <th className="text-right p-2">Move since earliest snapshot</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const price = quotes[r.quoteSymbol]?.price ?? null;
              const move = combinedMovePct(r, price);
              return (
                <tr key={r.ticker} className="border-b border-border/40 last:border-b-0">
                  <td className="p-2">
                    <Link
                      to="/tickers/$symbol"
                      params={{ symbol: r.ticker }}
                      className="font-mono hover:underline"
                    >
                      <TickerLabel ticker={r.ticker} showAlt={false} />
                    </Link>
                  </td>
                  <td className="p-2 text-right tabular-nums text-tailwind">
                    {r.activeLong}
                  </td>
                  <td className="p-2 text-right tabular-nums text-headwind">
                    {r.activeShort}
                  </td>
                  <td className="p-2">
                    <span
                      title={r.stance === "conflicted" ? CONFLICT_NOTE : undefined}
                      className={
                        "inline-block rounded border px-1.5 py-0.5 text-[10px] font-mono " +
                        STANCE_CLASS[r.stance]
                      }
                    >
                      {STANCE_LABEL[r.stance]}
                    </span>
                    {r.stance === "conflicted" && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {CONFLICT_NOTE}
                      </div>
                    )}
                  </td>
                  <td className={"p-2 text-right tabular-nums font-mono " + pctTone(move)}>
                    {fmtPct(move, 1)}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground">
                  {isLoading ? "Loading tickers…" : "No active signals yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </SiteShell>
  );
}
