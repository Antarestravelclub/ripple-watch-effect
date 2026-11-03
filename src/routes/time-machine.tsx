import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { SiteShell } from "@/components/site-shell";
import { TimeMachinePanel } from "@/components/time-machine-panel";

const Search = z.object({
  symbol: z.string().optional(),
  stop: z.coerce.number().positive().optional().catch(undefined),
  target: z.coerce.number().positive().optional().catch(undefined),
  horizon: z.coerce.number().int().min(3).max(30).optional().catch(undefined),
});

export const Route = createFileRoute("/time-machine")({
  validateSearch: (s) => Search.parse(s),
  head: () => ({
    meta: [
      { title: "Time Machine — test a trade before you take it | The Ripple Effect" },
      { name: "description", content: "Replay any stock trade 10,000 times from its own price history and see the odds of hitting your target before your stop." },
    ],
  }),
  component: TimeMachinePage,
});

const HORIZONS = [5, 10, 20];

function TimeMachinePage() {
  const q = Route.useSearch();
  const navigate = useNavigate({ from: "/time-machine" });
  const [sym, setSym] = useState(q.symbol ?? "");
  const [stop, setStop] = useState(q.stop != null ? String(q.stop) : "");
  const [target, setTarget] = useState(q.target != null ? String(q.target) : "");
  const [horizon, setHorizon] = useState(q.horizon ?? 10);
  const both = Number(stop) > 0 && Number(target) > 0;

  return (
    <SiteShell>
      <h1 className="text-2xl font-semibold tracking-tight">Time Machine</h1>
      <p className="text-sm text-muted-foreground mb-4">
        Test a buy before you risk a dollar. Enter a symbol — optionally your own stop and target — and it replays the next few
        sessions 10,000 times from the stock's own price history, then checks how the same trade did on every past day.
      </p>
      <form
        className="flex flex-wrap items-end gap-2 mb-5"
        onSubmit={(e) => {
          e.preventDefault();
          const s = sym.trim().toUpperCase();
          if (!s) return;
          navigate({ search: { symbol: s, stop: both ? Number(stop) : undefined, target: both ? Number(target) : undefined, horizon } });
        }}
      >
        <label className="text-[11px] text-muted-foreground">Symbol
          <input value={sym} onChange={(e) => setSym(e.target.value)} placeholder="e.g. TSLA"
            className="block w-28 rounded-md border border-border bg-background px-2 py-1.5 font-mono text-sm uppercase text-foreground" />
        </label>
        <label className="text-[11px] text-muted-foreground">Stop (optional)
          <input value={stop} onChange={(e) => setStop(e.target.value)} inputMode="decimal" placeholder="auto"
            className="block w-24 rounded-md border border-border bg-background px-2 py-1.5 font-mono text-sm text-foreground" />
        </label>
        <label className="text-[11px] text-muted-foreground">Target (optional)
          <input value={target} onChange={(e) => setTarget(e.target.value)} inputMode="decimal" placeholder="auto"
            className="block w-24 rounded-md border border-border bg-background px-2 py-1.5 font-mono text-sm text-foreground" />
        </label>
        <label className="text-[11px] text-muted-foreground">Hold up to
          <select value={horizon} onChange={(e) => setHorizon(Number(e.target.value))}
            className="block rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground">
            {HORIZONS.map((h) => <option key={h} value={h}>{h} days</option>)}
          </select>
        </label>
        <button type="submit" className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground">Run</button>
      </form>
      {(stop || target) && !both && (
        <p className="text-[11px] text-muted-foreground -mt-3 mb-4">Enter both a stop and a target to use your own levels — otherwise they're set automatically.</p>
      )}

      {q.symbol ? (
        <>
          <TimeMachinePanel symbol={q.symbol} horizon={q.horizon ?? 10} stop={q.stop} target={q.target} showBuy showChart />
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
            <Link to="/evaluate" search={{ symbol: q.symbol }} className="text-primary hover:underline">Full evaluation →</Link>
          </div>
          <p className="mt-4 text-[11px] text-muted-foreground">
            Auto levels: if the stock is below its 20-day average it uses the rebound rule (stop just under the recent low, target back at the average);
            otherwise stop 1.5 ATR below and target 3 ATR above. Your own stop/target must be below/above the current price.
            Buy opens a paper trade with the exact stop and target shown above. Odds come from past behaviour — markets can do things they haven't done before. Educational research only — not investment advice.
          </p>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">Enter a symbol to start.</p>
      )}
    </SiteShell>
  );
}
