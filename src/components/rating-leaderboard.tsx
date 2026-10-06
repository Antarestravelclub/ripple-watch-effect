import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getRankings, type RankedStock } from "@/lib/stock-eval.functions";

type Tab = "overview" | "Buy" | "Hold" | "Sell";
const COLS: { key: "Buy" | "Hold" | "Sell"; label: string; tone: string }[] = [
  { key: "Buy", label: "Top Buys", tone: "text-emerald-400 border-emerald-500/40" },
  { key: "Hold", label: "Holds", tone: "text-amber-400 border-amber-500/40" },
  { key: "Sell", label: "Sells / Weak", tone: "text-red-400 border-red-500/40" },
];

export function RatingLeaderboard({ onPick }: { onPick: (s: string) => void }) {
  const fn = useServerFn(getRankings);
  const [universe, setUniverse] = useState<"major" | "xm" | "au" | "ca" | "xmetf" | "auetf" | "caetf">("major");
  const q = useQuery({
    queryKey: ["eval-rankings", universe],
    queryFn: () => fn({ data: { universe } }),
    staleTime: 30 * 60_000,
    refetchInterval: (query) => ((query.state.data?.pending ?? 0) > 0 ? 15_000 : false),
  });
  const [tab, setTab] = useState<Tab>("overview");
  const rows = q.data?.rows ?? [];
  const bucket = (v: RankedStock["verdict"]) => {
    const r = rows.filter((x) => x.verdict === v);
    return v === "Sell" ? r.sort((a, b) => a.score - b.score) : r;
  };
  const cols = tab === "overview" ? COLS : COLS.filter((c) => c.key === tab);

  return (
    <section className="mb-6 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h2 className="text-lg font-semibold">Market ratings at a glance</h2>
          <p className="text-xs text-muted-foreground">
            {universe === "xmetf"
              ? "20 popular US ETFs tradable as CFDs on XM (.US suffix). Funds have no company profits, so scores lean on price trend and risk."
              : universe === "auetf"
              ? "15 popular ASX-listed ETFs (.AX). Scores lean on price trend and risk."
              : universe === "caetf"
                ? "15 popular TSX-listed ETFs (.TO), priced in Canadian dollars. Scores lean on price trend and risk."
              : universe === "xm"
              ? "Top 100 US stocks tradable as CFDs on XM (listed there with a .US suffix)."
              : universe === "au"
                ? "25 top ASX listings (.AX). Less company data is available for Australian stocks, so confidence is often lower."
                : universe === "ca"
                  ? "25 top TSX listings (.TO), priced in Canadian dollars. Less company data is available for Canadian stocks, so confidence is often lower."
                  : "30 major US stocks"} scored with the same model. Click one to see its full breakdown. Research only — not advice.
          </p>
        </div>
        <div className="flex flex-wrap gap-1 text-xs">
          {([["major", "Major 30"], ["xm", "XM tradable (100)"], ["au", "Australia (ASX 25)"], ["ca", "Canada (TSX 25)"], ["xmetf", "XM ETFs (20)"], ["auetf", "ASX ETFs (15)"], ["caetf", "TSX ETFs (15)"]] as const).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setUniverse(k)}
              className={`rounded-md px-2 py-1 border ${universe === k ? "bg-secondary text-secondary-foreground border-primary" : "border-border text-muted-foreground"}`}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="flex gap-1 text-xs">
          {(["overview", "Buy", "Hold", "Sell"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-md px-2 py-1 border ${tab === t ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}
            >
              {t === "overview" ? "Overview" : t === "Sell" ? "Sells" : `${t}s`}
            </button>
          ))}
        </div>
      </div>
      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Scoring the universe… this can take up to a minute the first time.</p>
      ) : q.isError || !rows.length ? (
        <p className="text-sm text-muted-foreground">Ratings unavailable right now. Try again shortly.</p>
      ) : (
        <div className={`grid gap-3 ${cols.length > 1 ? "md:grid-cols-3" : ""}`}>
          {cols.map((c) => {
            const list = bucket(c.key);
            const shown = tab === "overview" ? list.slice(0, 5) : list;
            return (
              <div key={c.key} className={`rounded-lg border ${c.tone} p-3`}>
                <h3 className={`text-sm font-semibold mb-2 ${c.tone}`}>
                  {c.label} <span className="text-muted-foreground font-normal">({list.length})</span>
                </h3>
                {!shown.length && <p className="text-xs text-muted-foreground">None right now.</p>}
                <ul className="space-y-1">
                  {shown.map((r) => (
                    <li key={r.symbol}>
                      <button
                        onClick={() => onPick(r.symbol)}
                        className="w-full text-left rounded-md px-2 py-1.5 hover:bg-muted/50"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-sm font-semibold">
                            {r.symbol}
                            {(universe === "xm" || universe === "xmetf") && <span className="ml-1 text-[10px] font-normal text-muted-foreground">XM: {r.symbol.replace(".", "")}.US</span>}
                          </span>
                          <span className="font-mono text-xs">
                            {r.price != null ? `$${r.price.toFixed(2)}` : "—"} · <b>{Math.round(r.score)}</b>/100
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {r.name ?? ""}{r.reason ? ` — ${r.reason}` : ""}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
      {q.data && q.data.pending > 0 && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Scoring more stocks… {q.data.total - q.data.pending} of {q.data.total} done. The list fills in automatically.
        </p>
      )}
      {q.data && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Updated {new Date(q.data.generatedAt).toLocaleString()} · refreshed every 6 hours.
        </p>
      )}
    </section>
  );
}
