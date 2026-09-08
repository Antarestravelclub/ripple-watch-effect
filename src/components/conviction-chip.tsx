import { convictionBand, CONVICTION_THRESHOLD, type ConvictionBreakdown } from "@/lib/conviction";

const TONE: Record<string, string> = {
  high: "border-tailwind/50 text-tailwind bg-tailwind/10",
  medium: "border-primary/50 text-primary bg-primary/10",
  low: "border-border/70 text-muted-foreground bg-background/60",
  below: "border-headwind/40 text-headwind bg-headwind/10",
};

/** Compact conviction score chip (0–100 rubric). */
export function ConvictionChip({
  score,
  breakdown,
}: {
  score: number | null | undefined;
  breakdown?: ConvictionBreakdown | null;
}) {
  if (score == null) return null;
  const band = convictionBand(score);
  const title = breakdown
    ? `Conviction ${score}/100 — severity ${breakdown.severity}, directness ${breakdown.directness}, analogues ${breakdown.analogues}${breakdown.analoguesEstimated ? " (no comparable history)" : ""}, freshness ${breakdown.freshness}`
    : `Conviction ${score}/100`;
  return (
    <span
      className={"text-[9px] font-mono px-1 py-px rounded border " + TONE[band]}
      title={title}
    >
      {score}
      {score < CONVICTION_THRESHOLD ? " ↓" : ""}
    </span>
  );
}

/** Full component breakdown, for the signal detail page. */
export function ConvictionBreakdownList({
  breakdown,
}: {
  breakdown: ConvictionBreakdown;
}) {
  const rows: Array<[string, number, number, string]> = [
    ["Event severity", breakdown.severity, 35, "Ripple magnitude of the driving event"],
    ["Directness of exposure", breakdown.directness, 30, "Named in the event vs second-order ripple"],
    [
      "Historical analogues",
      breakdown.analogues,
      25,
      breakdown.analogueHitRate != null
        ? `${Math.round(breakdown.analogueHitRate * 100)}% of comparable past events moved this way`
        : "No comparable history — scored neutral",
    ],
    ["Freshness", breakdown.freshness, 10, "10 points under 24h, decaying to 0 at 72h"],
  ];
  return (
    <ul className="space-y-2">
      {rows.map(([label, value, max, note]) => (
        <li key={label}>
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span>{label}</span>
            <span className="font-mono tabular-nums text-muted-foreground">
              {value}/{max}
            </span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-background/70 overflow-hidden">
            <div
              className="h-full bg-primary/70"
              style={{ width: `${Math.min(100, (value / max) * 100)}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">{note}</p>
        </li>
      ))}
    </ul>
  );
}
