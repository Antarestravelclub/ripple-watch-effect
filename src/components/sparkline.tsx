import type { SnapshotRow } from "@/lib/signal-metrics";

interface Props {
  snapshots: SnapshotRow[];
  signalPrice: number | null;
  targetPrice: number | null;
  invalidationPrice: number | null;
  direction: "long" | "short";
  height?: number;
}

export function Sparkline({
  snapshots,
  signalPrice,
  targetPrice,
  invalidationPrice,
  direction,
  height = 180,
}: Props) {
  const W = 800;
  const H = height;
  const padY = 20;
  if (snapshots.length < 2 && !signalPrice) {
    return (
      <div className="text-xs text-muted-foreground italic">
        Waiting for the first price snapshot.
      </div>
    );
  }
  const prices = snapshots.map((s) => s.price);
  const times = snapshots.map((s) => new Date(s.captured_at).getTime());
  const refValues = [signalPrice, targetPrice, invalidationPrice].filter(
    (v): v is number => v != null,
  );
  const minP = Math.min(...prices, ...refValues);
  const maxP = Math.max(...prices, ...refValues);
  const rangeP = maxP - minP || 1;
  const minT = times[0];
  const maxT = times[times.length - 1] || minT + 1;
  const rangeT = maxT - minT || 1;

  const x = (t: number) => ((t - minT) / rangeT) * (W - 20) + 10;
  const y = (p: number) => H - padY - ((p - minP) / rangeP) * (H - 2 * padY);

  const points = snapshots
    .map((s) => `${x(new Date(s.captured_at).getTime())},${y(s.price)}`)
    .join(" ");

  const lineColor = direction === "long" ? "var(--tailwind)" : "var(--headwind)";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      <defs>
        <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={lineColor} stopOpacity="0.25" />
          <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      {signalPrice != null && (
        <RefLine y={y(signalPrice)} label={`Signal $${signalPrice.toFixed(2)}`} tone="muted" W={W} />
      )}
      {targetPrice != null && (
        <RefLine y={y(targetPrice)} label={`Target $${targetPrice.toFixed(2)}`} tone="tailwind" W={W} />
      )}
      {invalidationPrice != null && (
        <RefLine
          y={y(invalidationPrice)}
          label={`Invalidation $${invalidationPrice.toFixed(2)}`}
          tone="headwind"
          W={W}
        />
      )}
      {snapshots.length >= 2 && (
        <>
          <polygon
            points={`10,${H - padY} ${points} ${W - 10},${H - padY}`}
            fill="url(#spark-fill)"
          />
          <polyline points={points} fill="none" stroke={lineColor} strokeWidth={2} />
        </>
      )}
    </svg>
  );
}

function RefLine({
  y,
  label,
  tone,
  W,
}: {
  y: number;
  label: string;
  tone: "tailwind" | "headwind" | "muted";
  W: number;
}) {
  const stroke =
    tone === "tailwind"
      ? "var(--tailwind)"
      : tone === "headwind"
      ? "var(--headwind)"
      : "var(--muted-foreground)";
  return (
    <g>
      <line
        x1={10}
        x2={W - 10}
        y1={y}
        y2={y}
        stroke={stroke}
        strokeDasharray="3 3"
        strokeOpacity={0.6}
      />
      <text
        x={W - 12}
        y={y - 3}
        fontSize="10"
        textAnchor="end"
        fill={stroke}
        opacity={0.8}
      >
        {label}
      </text>
    </g>
  );
}
