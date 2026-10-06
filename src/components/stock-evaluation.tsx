import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { evaluateStock, type Evaluation } from "@/lib/stock-eval.functions";

const VERDICT_CLASS: Record<string, string> = {
  Buy: "bg-tailwind/15 text-tailwind border-tailwind/40",
  Hold: "bg-muted/40 text-foreground border-border",
  Sell: "bg-headwind/15 text-headwind border-headwind/40",
};

function barTone(s: number | null) {
  if (s == null) return "bg-muted";
  return s >= 65 ? "bg-tailwind" : s <= 40 ? "bg-headwind" : "bg-primary";
}

function MiniLine({ closes }: { closes: number[] }) {
  if (closes.length < 2) return null;
  const lo = Math.min(...closes), hi = Math.max(...closes);
  const pts = closes
    .map((c, i) => `${(i / (closes.length - 1)) * 200},${40 - ((c - lo) / (hi - lo || 1)) * 38 - 1}`)
    .join(" ");
  const up = closes[closes.length - 1]! >= closes[0]!;
  return (
    <svg viewBox="0 0 200 40" className="h-10 w-40" preserveAspectRatio="none" aria-label="6-month price line">
      <polyline points={pts} fill="none" strokeWidth="1.5" className={up ? "stroke-tailwind" : "stroke-headwind"} />
    </svg>
  );
}

export function StockEvaluation({ ticker }: { ticker: string }) {
  const run = useServerFn(evaluateStock);
  const symbol = ticker.trim().toUpperCase();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["evaluate", symbol],
    queryFn: () => run({ data: { ticker: symbol } }),
    enabled: symbol.length > 0,
    staleTime: 10 * 60_000,
  });

  return (
    <section className="rounded-xl border border-border/70 bg-card/60 p-4 mb-5">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 className="text-sm font-semibold tracking-tight">Stock evaluation</h2>
        <span className="text-[11px] text-muted-foreground">Buy / Hold / Sell model</span>
      </div>
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Evaluating {symbol}…</p>
      ) : isError || !data ? (
        <p className="text-xs text-muted-foreground">Couldn't evaluate {symbol} right now.</p>
      ) : (
        <Body e={data} />
      )}
    </section>
  );
}

function Body({ e }: { e: Evaluation }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-4">
        {e.verdict ? (
          <span className={"rounded-lg border px-4 py-2 text-xl font-semibold " + VERDICT_CLASS[e.verdict]}>
            {e.verdict}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">Not enough data for a verdict</span>
        )}
        <div>
          <div className="font-mono text-2xl tabular-nums">{e.score == null ? "—" : Math.round(e.score)}<span className="text-sm text-muted-foreground">/100</span></div>
          <div className="text-[11px] text-muted-foreground">Confidence: {e.confidence}</div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-xs text-muted-foreground">{e.name ?? e.symbol}</div>
          <div className="font-mono tabular-nums">{e.price == null ? "—" : `$${e.price.toFixed(2)}`}</div>
          <MiniLine closes={e.closes} />
        </div>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">65+ = Buy · 41–64 = Hold · 40 or below = Sell. Weighted: profitability 30%, momentum 25%, outlook 25%, valuation 20%.</p>

      <div className="grid gap-3 sm:grid-cols-2 mt-4">
        {e.pillars.map((p) => (
          <div key={p.key} className="rounded-lg border border-border/60 bg-background/40 p-3">
            <div className="flex items-center justify-between text-xs font-medium">
              <span>{p.title}</span>
              <span className="font-mono tabular-nums">{p.score == null ? "—" : Math.round(p.score)}</span>
            </div>
            <div className="mt-1.5 h-1.5 rounded bg-muted overflow-hidden">
              <div className={"h-full " + barTone(p.score)} style={{ width: `${p.score ?? 0}%` }} />
            </div>
            <dl className="mt-2 space-y-1">
              {p.factors.map((f) => (
                <div key={f.label} className="flex justify-between gap-2 text-[11px]" title={f.note}>
                  <dt className="text-muted-foreground">{f.label}</dt>
                  <dd className="font-mono tabular-nums">{f.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>

      {e.dividend && (
        <div className="mt-3 rounded-lg border border-border/60 bg-background/40 p-3">
          <div className="flex items-center justify-between text-xs font-medium mb-2">
            <span>Dividend</span>
            <span className={"rounded border px-1.5 py-0.5 text-[10px] " + (e.dividend.safety === "Safe" ? "border-tailwind/40 text-tailwind" : e.dividend.safety === "At risk" ? "border-headwind/40 text-headwind" : "border-border text-muted-foreground")}>
              {e.dividend.safety}
            </span>
          </div>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            <div><dt className="text-muted-foreground">Yield</dt><dd className="font-mono text-sm">{e.dividend.yieldPct.toFixed(2)}%</dd></div>
            <div><dt className="text-muted-foreground">Per share / yr</dt><dd className="font-mono text-sm">{e.dividend.perShare == null ? "—" : `$${e.dividend.perShare.toFixed(2)}`}</dd></div>
            <div><dt className="text-muted-foreground">Payout of profit</dt><dd className="font-mono text-sm">{e.dividend.payoutPct == null ? "—" : `${e.dividend.payoutPct.toFixed(0)}%`}</dd></div>
            <div><dt className="text-muted-foreground">5-yr growth</dt><dd className="font-mono text-sm">{e.dividend.growth5yPct == null ? "—" : `${e.dividend.growth5yPct.toFixed(1)}%/yr`}</dd></div>
          </dl>
          <p className="mt-2 text-[11px] text-muted-foreground">Safety check: {e.dividend.note}.</p>
        </div>
      )}

      {e.risks.length > 0 && (
        <div className="mt-3 rounded-lg border border-border/60 bg-muted/20 p-3">
          <div className="text-xs font-medium mb-1">Risk check</div>
          <ul className="list-disc pl-4 text-[11px] text-muted-foreground space-y-0.5">
            {e.risks.map((r) => <li key={r}>{r}</li>)}
          </ul>
        </div>
      )}
      <p className="mt-3 text-[11px] text-muted-foreground">
        Model output from public price history, company financials and analyst ratings. Educational research only — not investment advice.
      </p>
    </>
  );
}
