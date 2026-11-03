import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Fragment, useState } from "react";
import { SiteShell } from "@/components/site-shell";
import { getRebounds, type ReboundRow, type ReboundUniverse } from "@/lib/rebound.functions";
import { TimeMachinePanel } from "@/components/time-machine-panel";
import { ManualPaperTradeButton } from "@/components/paper-trade-dialog";

export const Route = createFileRoute("/rebound")({
  head: () => ({
    meta: [
      { title: "Rebound — biggest losers likely to bounce | The Ripple Effect" },
      { name: "description", content: "The biggest 1–3 day losers, scored on how likely they are to snap back to their normal price." },
      { property: "og:title", content: "Rebound — The Ripple Effect" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: ReboundPage,
});

const UNIVERSES: { k: ReboundUniverse; label: string }[] = [
  { k: "xm", label: "XM top 100" },
  { k: "major", label: "Major 30" },
  { k: "xmetf", label: "XM ETFs" },
  { k: "ca", label: "TSX" },
  { k: "au", label: "ASX" },
];

const GRADE_CLASS: Record<ReboundRow["grade"], string> = {
  Strong: "border-tailwind/40 bg-tailwind/15 text-tailwind",
  Possible: "border-border bg-muted/40 text-foreground",
  Weak: "border-headwind/40 bg-headwind/15 text-headwind",
};

const money = (v: number | null) => (v == null ? "—" : `$${v.toFixed(2)}`);

function Spark({ closes }: { closes: number[] }) {
  if (closes.length < 2) return null;
  const lo = Math.min(...closes), hi = Math.max(...closes);
  const pts = closes.map((c, i) => `${(i / (closes.length - 1)) * 100},${30 - ((c - lo) / (hi - lo || 1)) * 28 - 1}`).join(" ");
  return (
    <svg viewBox="0 0 100 30" className="h-7 w-24" preserveAspectRatio="none" aria-label="30-day price line">
      <polyline points={pts} fill="none" strokeWidth="1.5" className="stroke-headwind" />
    </svg>
  );
}

function ReboundPage() {
  const fn = useServerFn(getRebounds);
  const [universe, setUniverse] = useState<ReboundUniverse>("xm");
  const [days, setDays] = useState(2);
  const [open, setOpen] = useState<string | null>(null);
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["rebounds", universe, days],
    queryFn: () => fn({ data: { universe, days } }),
    staleTime: 10 * 60_000,
  });
  const top5 = (data?.rows ?? []).slice(0, 5).map((r) => r.symbol).join(",");

  return (
    <SiteShell>
      <h1 className="text-2xl font-semibold tracking-tight">Rebound</h1>
      <p className="text-sm text-muted-foreground mb-4">
        The biggest losers of the last few completed sessions, scored on how likely they are to bounce back toward their normal (20-day average) price.
      </p>

      <div className="flex flex-wrap items-center gap-3 mb-4 text-xs">
        <div className="flex gap-1">
          {UNIVERSES.map(({ k, label }) => (
            <button key={k} onClick={() => setUniverse(k)}
              className={`rounded-md px-2 py-1 border ${universe === k ? "bg-secondary text-secondary-foreground border-primary" : "border-border text-muted-foreground"}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">Lookback:</span>
          {[1, 2, 3].map((d) => (
            <button key={d} onClick={() => setDays(d)}
              className={`rounded-md px-2 py-1 border ${days === d ? "bg-secondary text-secondary-foreground border-primary" : "border-border text-muted-foreground"}`}>
              {d === 1 ? "Yesterday" : `${d} days`}
            </button>
          ))}
        </div>
        <button onClick={() => refetch()} className="ml-auto rounded-md border border-border px-2 py-1 text-muted-foreground">
          {isFetching ? "Scanning…" : "Refresh"}
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Scanning for the biggest losers… up to a minute the first time.</p>
      ) : isError || !data ? (
        <p className="text-sm text-muted-foreground">Couldn't run the scan right now. Try Refresh.</p>
      ) : data.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No losers in this group over that window — nothing to rebound.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2 text-[11px] text-muted-foreground">
            <span>
              Top {data.rows.length} losers of {data.scanned} scanned{data.failed ? ` (${data.failed} unavailable)` : ""} · ranked by rebound score · as of {new Date(data.generatedAt).toLocaleTimeString()}
            </span>
            {top5 && (
              <Link to="/evaluate" search={{ compare: top5 }} className="text-primary hover:underline">
                Compare top 5 in Evaluate →
              </Link>
            )}
          </div>
          <div className="overflow-x-auto rounded-xl border border-border/70 bg-card/60">
            <table className="w-full min-w-[720px] text-[12px]">
              <thead>
                <tr className="text-left text-[11px] text-muted-foreground border-b border-border/60">
                  <th className="p-2 font-medium">Symbol</th>
                  <th className="p-2 font-medium">Rebound</th>
                  <th className="p-2 font-medium text-right">Drop</th>
                  <th className="p-2 font-medium text-right">× normal</th>
                  <th className="p-2 font-medium text-right">RSI</th>
                  <th className="p-2 font-medium text-right">Price</th>
                  <th className="p-2 font-medium text-right">Normal (20d)</th>
                  <th className="p-2 font-medium text-right">Upside</th>
                  <th className="p-2 font-medium text-right">Stop</th>
                  <th className="p-2 font-medium text-right">R/R</th>
                  <th className="p-2 font-medium">30d</th>
                  <th className="p-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <Fragment key={r.symbol}>
                    <tr onClick={() => setOpen(open === r.symbol ? null : r.symbol)}
                      className="border-b border-border/40 cursor-pointer hover:bg-muted/20">
                      <td className="p-2 font-mono font-medium">{r.symbol}</td>
                      <td className="p-2">
                        <span className={"rounded border px-1.5 py-0.5 text-[11px] " + GRADE_CLASS[r.grade]}>{r.grade}</span>
                        <span className="ml-1.5 font-mono tabular-nums">{Math.round(r.score)}</span>
                      </td>
                      <td className="p-2 text-right font-mono tabular-nums text-headwind">{r.dropPct.toFixed(1)}%</td>
                      <td className="p-2 text-right font-mono tabular-nums">{r.dropAtr.toFixed(1)}</td>
                      <td className="p-2 text-right font-mono tabular-nums">{r.rsi14 == null ? "—" : r.rsi14.toFixed(0)}</td>
                      <td className="p-2 text-right font-mono tabular-nums">{money(r.price)}</td>
                      <td className="p-2 text-right font-mono tabular-nums">{money(r.sma20)}</td>
                      <td className="p-2 text-right font-mono tabular-nums text-tailwind">{r.upsidePct == null ? "—" : `+${r.upsidePct.toFixed(1)}%`}</td>
                      <td className="p-2 text-right font-mono tabular-nums">{money(r.stop)}</td>
                      <td className="p-2 text-right font-mono tabular-nums">{r.rewardRisk == null ? "—" : r.rewardRisk.toFixed(1)}</td>
                      <td className="p-2"><Spark closes={r.closes} /></td>
                      <td className="p-2" onClick={(e) => e.stopPropagation()}>
                        <BuyButton r={r} days={days} />
                      </td>
                    </tr>
                    {open === r.symbol && (
                      <tr className="border-b border-border/40 bg-background/40">
                        <td colSpan={12} className="p-3">
                          <div className="mb-3"><TimeMachinePanel symbol={r.symbol} days={days} showBuy /></div>
                          <div className="grid gap-3 sm:grid-cols-2 text-[11px]">
                            <div>
                              <div className="font-medium mb-1 text-tailwind">Why it could bounce</div>
                              {r.positives.length ? (
                                <ul className="list-disc pl-4 space-y-0.5">{r.positives.map((p) => <li key={p}>{p}</li>)}</ul>
                              ) : <p className="text-muted-foreground">No strong rebound signs.</p>}
                            </div>
                            <div>
                              <div className="font-medium mb-1 text-headwind">Watch out</div>
                              {r.warnings.length ? (
                                <ul className="list-disc pl-4 space-y-0.5">{r.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
                              ) : <p className="text-muted-foreground">No red flags from price action.</p>}
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px]">
                            <Link to="/evaluate" search={{ symbol: r.symbol }} className="text-primary hover:underline">Full evaluation →</Link>
                            <Link to="/tickers/$symbol" params={{ symbol: r.symbol }} className="text-primary hover:underline">Events &amp; chart →</Link>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Score weighs how stretched the drop is versus the stock's normal daily range (30%), oversold RSI (25%), whether the long-term trend is still up (25%) and room back to the 20-day average (20%). Big single-day gaps and new 52-week lows are penalised — those are often news-driven and don't revert. Tap a row for details and the Time Machine odds. Buy opens a paper trade pre-filled with this stop and target; mirror it to your XM demo from the Trade Log. Educational research only — not investment advice.
          </p>
        </>
      )}
    </SiteShell>
  );
}

function BuyButton({ r, days, label = "Buy" }: { r: ReboundRow; days: number; label?: string }) {
  if (r.stop == null || r.sma20 == null || r.sma20 <= r.price) return null;
  return (
    <ManualPaperTradeButton
      symbol={r.symbol}
      label={label}
      compact
      preset={{
        stop: r.stop,
        target: r.sma20,
        notes: `Rebound ${days}d: ${r.grade} ${Math.round(r.score)}, drop ${r.dropPct.toFixed(1)}%`,
      }}
    />
  );
}
