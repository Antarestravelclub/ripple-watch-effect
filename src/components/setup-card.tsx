import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { fmtPct, fmtPrice, pctTone } from "@/lib/signal-metrics";
import { scoreLabel, scoreTone, type SwingSetup } from "@/lib/swing-setups";

function Level({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone?: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={"font-mono text-sm font-semibold " + (tone ?? "text-foreground")}>{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

export function SetupCard({ setup }: { setup: SwingSetup }) {
  const long = setup.direction === "long";
  const dirClass = long
    ? "bg-tailwind/15 text-tailwind border-tailwind/30"
    : "bg-headwind/15 text-headwind border-headwind/30";

  return (
    <article className="rounded-xl border border-border/70 bg-card/50 p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              to="/tickers/$symbol"
              params={{ symbol: setup.ticker }}
              className="font-mono text-base font-semibold hover:text-primary"
            >
              {setup.displaySymbol}
            </Link>
            <span className={"text-[10px] px-2 py-0.5 rounded-full border " + dirClass}>
              {long ? "TAILWIND · LONG" : "HEADWIND · SHORT"}
            </span>
            <span
              className={"text-[10px] px-2 py-0.5 rounded-full border " + scoreTone(setup.score)}
            >
              {scoreLabel(setup.score)} · {setup.score}
            </span>
          </div>
          {setup.companyName && (
            <div className="text-xs text-muted-foreground mt-0.5">{setup.companyName}</div>
          )}
          {setup.event && (
            <Link
              to="/event/$id"
              params={{ id: setup.event.id }}
              className="block text-sm mt-1.5 hover:text-primary"
            >
              {setup.event.headline}
            </Link>
          )}
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Last</div>
          <div className="font-mono text-sm font-semibold">{fmtPrice(setup.currentPrice)}</div>
          <div className={"text-[11px] " + pctTone(setup.movePctSinceSnapshot)}>
            {setup.actualMovePct == null
              ? "—"
              : `${fmtPct(setup.actualMovePct)} actual since map`}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2 mt-3">
        <Level
          label="Entry zone"
          value={
            setup.entryLow != null && setup.entryHigh != null
              ? `${fmtPrice(setup.entryLow)} – ${fmtPrice(setup.entryHigh)}`
              : "—"
          }
          hint="tolerance band"
        />
        <Level
          label="Target"
          value={fmtPrice(setup.target)}
          tone="text-tailwind"
          hint={`${setup.expectedMovePct}% expected move`}
        />
        <Level
          label="Exit / invalidation"
          value={fmtPrice(setup.invalidation)}
          tone="text-headwind"
          hint={`${(setup.expectedMovePct / 2).toFixed(1)}% against`}
        />
        <Level
          label="Reward : risk"
          value={`${setup.rewardRisk.toFixed(1)} : 1`}
          hint={`${setup.daysLeft}/${setup.daysOpen + setup.daysLeft} trading days left`}
        />
        <Level
          label="Remaining to target"
          value={fmtPct(setup.remainingTargetPct)}
          tone={pctTone(setup.remainingTargetPct)}
          hint="favorable move"
        />
        <Level
          label="Opportunity rank"
          value={`${setup.opportunityRank} / 100`}
          hint="risk-adjusted comparison"
        />
      </div>

      <p className="text-xs text-muted-foreground mt-3">{setup.mechanism}</p>

      {setup.flags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {setup.flags.map((f) => (
            <span
              key={f}
              className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border border-headwind/30 bg-headwind/10 text-headwind"
            >
              <AlertTriangle className="w-3 h-3" />
              {f}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 mt-3 pt-2 border-t border-border/50">
        <p className="text-[10px] text-muted-foreground">
          Mechanical levels from event magnitude — not a price prediction or advice.
        </p>
        <Link
          to="/signal/$id"
          params={{ id: setup.signal.id }}
          className="text-[11px] text-primary hover:underline whitespace-nowrap"
        >
          Track history →
        </Link>
      </div>
    </article>
  );
}
