import { useQueries } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { evaluateStock, type Evaluation, type Pillar } from "@/lib/stock-eval.functions";

export const COMPARE_SLOTS = 5;

const PILLARS: { key: Pillar["key"]; short: string }[] = [
  { key: "price", short: "Valuation" },
  { key: "past", short: "Momentum" },
  { key: "profit", short: "Profitability" },
  { key: "outlook", short: "Outlook" },
];

const VERDICT_CLASS: Record<string, string> = {
  Buy: "border-tailwind/40 bg-tailwind/15 text-tailwind",
  Hold: "border-border bg-muted/40 text-foreground",
  Sell: "border-headwind/40 bg-headwind/15 text-headwind",
};

const CONF_RANK: Record<Evaluation["confidence"], number> = { High: 2, Medium: 1, Low: 0 };

const pillarScore = (e: Evaluation, k: Pillar["key"]) => e.pillars.find((p) => p.key === k)?.score ?? null;

/** Best pick = highest overall score; ties broken by confidence then momentum. */
function pickBest(rows: Evaluation[]): Evaluation | null {
  const scored = rows.filter((e) => e.score != null && e.verdict);
  if (!scored.length) return null;
  return [...scored].sort(
    (a, b) =>
      (b.score ?? 0) - (a.score ?? 0) ||
      CONF_RANK[b.confidence] - CONF_RANK[a.confidence] ||
      (pillarScore(b, "past") ?? 0) - (pillarScore(a, "past") ?? 0),
  )[0]!;
}

function bestReason(best: Evaluation, others: Evaluation[]): string {
  const wins = PILLARS.filter(({ key }) => {
    const mine = pillarScore(best, key);
    return mine != null && others.every((o) => (pillarScore(o, key) ?? -1) <= mine);
  }).map((p) => p.short.toLowerCase());
  const parts = [`highest overall score (${Math.round(best.score ?? 0)})`];
  if (wins.length) parts.push(`leads on ${wins.join(", ")}`);
  return parts.join("; ");
}

export function StockCompare({ initial, onChange }: { initial: string[]; onChange: (symbols: string[]) => void }) {
  const run = useServerFn(evaluateStock);
  const [inputs, setInputs] = useState<string[]>(() =>
    Array.from({ length: COMPARE_SLOTS }, (_, i) => initial[i] ?? ""),
  );
  useEffect(() => {
    setInputs(Array.from({ length: COMPARE_SLOTS }, (_, i) => initial[i] ?? ""));
  }, [initial.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const symbols = initial;
  const results = useQueries({
    queries: symbols.map((s) => ({
      queryKey: ["evaluate", s],
      queryFn: () => run({ data: { ticker: s } }),
      staleTime: 10 * 60_000,
    })),
  });

  const loading = results.some((r) => r.isLoading);
  const rows = results.map((r) => r.data).filter((d): d is Evaluation => !!d);
  const best = loading ? null : pickBest(rows);
  const others = best ? rows.filter((r) => r.symbol !== best.symbol) : [];

  const submit = () => {
    const clean = [...new Set(inputs.map((s) => s.trim().toUpperCase()).filter(Boolean))].slice(0, COMPARE_SLOTS);
    onChange(clean);
  };

  return (
    <section className="rounded-xl border border-border/70 bg-card/60 p-4 mb-5">
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <h2 className="text-sm font-semibold tracking-tight">Compare up to 5 stocks</h2>
        <span className="text-[11px] text-muted-foreground">Which scores best right now?</span>
      </div>
      <p className="text-[11px] text-muted-foreground mb-3">
        Enter up to five symbols. Each is run through the same Buy / Hold / Sell model and ranked side by side.
      </p>
      <form
        className="flex flex-wrap gap-2 mb-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {inputs.map((v, i) => (
          <input
            key={i}
            aria-label={`Compare symbol ${i + 1}`}
            value={v}
            onChange={(e) => setInputs((xs) => xs.map((x, j) => (j === i ? e.target.value : x)))}
            placeholder={["AAPL", "MSFT", "NVDA", "XOM", "JPM"][i]}
            className="w-24 rounded-md border border-border bg-background px-2 py-1.5 font-mono text-sm uppercase"
          />
        ))}
        <button type="submit" className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground">
          Compare
        </button>
        {symbols.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setInputs(Array(COMPARE_SLOTS).fill(""));
              onChange([]);
            }}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground"
          >
            Clear
          </button>
        )}
      </form>

      {symbols.length === 0 ? null : (
        <>
          {loading ? (
            <p className="text-xs text-muted-foreground mb-3">Evaluating {symbols.join(", ")}…</p>
          ) : best ? (
            <div className="mb-3 rounded-lg border border-tailwind/40 bg-tailwind/10 p-3">
              <div className="text-xs text-muted-foreground">Best pick right now</div>
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-mono text-lg font-semibold">{best.symbol}</span>
                <span className={"rounded border px-1.5 py-0.5 text-[11px] " + VERDICT_CLASS[best.verdict!]}>{best.verdict}</span>
                <span className="text-[11px] text-muted-foreground">{bestReason(best, others)}</span>
              </div>
              {best.verdict !== "Buy" && (
                <p className="mt-1 text-[11px] text-headwind">
                  None of these rate a Buy — {best.symbol} is only the least weak of the group.
                </p>
              )}
              {best.confidence === "Low" && (
                <p className="mt-1 text-[11px] text-muted-foreground">Low data confidence on this pick — treat cautiously.</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground mb-3">Not enough data to rank these.</p>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-[12px]">
              <thead>
                <tr className="text-left text-[11px] text-muted-foreground border-b border-border/60">
                  <th className="py-1.5 pr-2 font-medium">#</th>
                  <th className="py-1.5 pr-2 font-medium">Symbol</th>
                  <th className="py-1.5 pr-2 font-medium">Verdict</th>
                  <th className="py-1.5 pr-2 font-medium text-right">Score</th>
                  {PILLARS.map((p) => (
                    <th key={p.key} className="py-1.5 pr-2 font-medium text-right">{p.short}</th>
                  ))}
                  <th className="py-1.5 pr-2 font-medium text-right">Price</th>
                  <th className="py-1.5 font-medium">Conf.</th>
                </tr>
              </thead>
              <tbody>
                {symbols
                  .map((s, i) => ({ s, r: results[i] }))
                  .sort((a, b) => (b.r?.data?.score ?? -1) - (a.r?.data?.score ?? -1))
                  .map(({ s, r }, rank) => {
                    const e = r?.data;
                    const isBest = best?.symbol === s;
                    return (
                      <tr key={s} className={"border-b border-border/40 " + (isBest ? "bg-tailwind/5" : "")}>
                        <td className="py-1.5 pr-2 text-muted-foreground">{e?.score != null ? rank + 1 : "—"}</td>
                        <td className="py-1.5 pr-2">
                          <div className="font-mono font-medium">{s}</div>
                          {e?.name && <div className="text-[10px] text-muted-foreground truncate max-w-[140px]">{e.name}</div>}
                        </td>
                        {r?.isLoading ? (
                          <td colSpan={PILLARS.length + 4} className="py-1.5 text-muted-foreground">Evaluating…</td>
                        ) : !e ? (
                          <td colSpan={PILLARS.length + 4} className="py-1.5 text-muted-foreground">Couldn't evaluate</td>
                        ) : (
                          <>
                            <td className="py-1.5 pr-2">
                              {e.verdict ? (
                                <span className={"rounded border px-1.5 py-0.5 text-[11px] " + VERDICT_CLASS[e.verdict]}>{e.verdict}</span>
                              ) : "—"}
                            </td>
                            <td className="py-1.5 pr-2 text-right font-mono tabular-nums font-semibold">
                              {e.score == null ? "—" : Math.round(e.score)}
                            </td>
                            {PILLARS.map(({ key }) => {
                              const v = pillarScore(e, key);
                              const top = v != null && rows.every((o) => (pillarScore(o, key) ?? -1) <= v);
                              return (
                                <td key={key} className={"py-1.5 pr-2 text-right font-mono tabular-nums " + (top && rows.length > 1 ? "text-tailwind font-semibold" : "")}>
                                  {v == null ? "—" : Math.round(v)}
                                </td>
                              );
                            })}
                            <td className="py-1.5 pr-2 text-right font-mono tabular-nums">{e.price == null ? "—" : `$${e.price.toFixed(2)}`}</td>
                            <td className="py-1.5 text-muted-foreground">{e.confidence}</td>
                          </>
                        )}
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Green = best in that column. Ranked by overall model score (ties: higher confidence, then stronger momentum). Educational research only — not investment advice.
          </p>
        </>
      )}
    </section>
  );
}
