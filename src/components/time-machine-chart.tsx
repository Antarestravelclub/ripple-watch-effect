import { useEffect, useMemo, useState } from "react";
import type { TimeMachineResult } from "@/lib/rebound.functions";

// "Replay" fan chart: a sample of the simulated paths drawn from entry to the
// day each one hit target (green), stop (red), or ran out of time (blue-grey,
// stacked on the right as "Still open"). Tick marks on the target/stop lines
// show where paths landed. Pure SVG, animates in once per symbol.

const GREEN = "#34d399";
const RED = "#f87171";
const OPEN = "#a5b4fc";

const W = 640, H = 380;

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const PAD = { l: 18, r: 100, t: 60, b: 64 };

export function TimeMachineChart({ data }: { data: TimeMachineResult }) {
  const sample = data.sim.sample ?? [];
  const horizon = data.horizonDays;
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    setDrawn(false);
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setDrawn(true)));
    return () => cancelAnimationFrame(id);
  }, [data.symbol, data.seed, data.stop, data.target]);

  const geo = useMemo(() => {
    const lo = data.stop, hi = data.target;
    const span = hi - lo || 1;
    const x = (d: number) => PAD.l + 14 + (d / horizon) * (W - PAD.l - PAD.r - 14);
    const y = (p: number) => PAD.t + ((hi - p) / span) * (H - PAD.t - PAD.b);
    const clampY = (p: number) => y(Math.min(hi, Math.max(lo, p)));
    // Draw open paths first, then stops, then targets so the colours read on top.
    const order = { o: 0, s: 1, t: 2 } as const;
    // Daily closes only give one point per session, so for the look of an intraday
    // replay we fill each day with a small seeded Brownian bridge between closes
    // (visual only — the odds come from the server). Hit paths end part-way through
    // their final session, like a real stop/target touch.
    const amp = span * 0.035;
    const SUB = 8;
    const paths = [...sample]
      .map((s, idx) => ({ s, idx }))
      .sort((a, b) => order[a.s.o] - order[b.s.o])
      .map(({ s, idx }) => {
        const rnd = rng(idx * 9973 + 17);
        const last = s.pts.length - 1;
        const endFrac = s.o === "o" ? 1 : 0.35 + rnd() * 0.65;
        let d = `M${x(0).toFixed(1)},${clampY(s.pts[0]!).toFixed(1)}`;
        let ex = x(0), ey = clampY(s.pts[0]!);
        for (let k = 1; k <= last; k++) {
          const a = s.pts[k - 1]!, b = s.pts[k]!;
          const t0 = k - 1, len = k === last ? endFrac : 1;
          let w = 0;
          for (let j = 1; j <= SUB; j++) {
            const f = j / SUB;
            w += (rnd() - 0.5) * amp;
            const price = j === SUB ? b : a + (b - a) * f + w * Math.sin(Math.PI * f);
            ex = x(t0 + len * f); ey = clampY(price);
            d += `L${ex.toFixed(1)},${ey.toFixed(1)}`;
          }
        }
        return { o: s.o, d, endX: ex, endY: ey };
      });
    return { x, y, paths };
  }, [sample, horizon, data.stop, data.target]);

  if (!sample.length) return null;

  const yT = geo.y(data.target), yS = geo.y(data.stop), yE = geo.y(data.entry);
  const xEnd = geo.x(horizon);
  const color = (o: "t" | "s" | "o") => (o === "t" ? GREEN : o === "s" ? RED : OPEN);
  const s = data.sim;

  return (
    <div className="rounded-xl border border-white/10 bg-[#0b0d14] p-3 text-white">
      <div className="flex items-end justify-between gap-2 px-1">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-medium">
            <span aria-hidden>⟲</span> Time Machine · {data.symbol}
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-4xl font-bold tracking-tight tabular-nums">{s.paths.toLocaleString()}</span>
            <span className="text-lg text-white/50">replays</span>
          </div>
        </div>
        <div className="text-right text-[11px] leading-tight tabular-nums">
          <div style={{ color: GREEN }}>Target {s.targetPct.toFixed(0)}%</div>
          <div style={{ color: RED }}>Stop {s.stopPct.toFixed(0)}%</div>
          <div style={{ color: OPEN }}>Open {s.openPct.toFixed(0)}%</div>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 h-auto w-full" role="img"
        aria-label={`${s.paths} simulated paths for ${data.symbol}: ${s.targetPct.toFixed(0)}% hit target, ${s.stopPct.toFixed(0)}% hit stop, ${s.openPct.toFixed(0)}% still open after ${horizon} sessions`}>
        <defs>
          <radialGradient id="tm-glow">
            <stop offset="0%" stopColor="#818cf8" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
          </radialGradient>
        </defs>

        <text x={PAD.l} y={yT - 14} fill={GREEN} fontSize="26" fontWeight="800">Target ${data.target.toFixed(2)}</text>
        <text x={PAD.l} y={yS + 34} fill={RED} fontSize="26" fontWeight="800">Stop ${data.stop.toFixed(2)}</text>
        <line x1={geo.x(0)} x2={xEnd} y1={yT} y2={yT} stroke={GREEN} strokeWidth="1.5" strokeDasharray="6 6" opacity="0.8" />
        <line x1={geo.x(0)} x2={xEnd} y1={yS} y2={yS} stroke={RED} strokeWidth="1.5" strokeDasharray="6 6" opacity="0.8" />

        <g fill="none" strokeLinejoin="round" strokeLinecap="round">
          {geo.paths.map((p, i) => (
            <path key={i} d={p.d} stroke={color(p.o)} strokeWidth="1.1" opacity={p.o === "o" ? 0.35 : 0.5}
              pathLength={1} strokeDasharray="1"
              style={{
                strokeDashoffset: drawn ? 0 : 1,
                transition: `stroke-dashoffset 1.6s cubic-bezier(.2,.7,.2,1) ${(i % 60) * 12}ms`,
              }} />
          ))}
        </g>

        {/* Hit ticks on the target/stop lines, and the "still open" stack at the right edge */}
        <g style={{ opacity: drawn ? 1 : 0, transition: "opacity .6s ease 1.4s" }}>
          {geo.paths.filter((p) => p.o !== "o").map((p, i) => (
            <line key={i} x1={p.endX} x2={p.endX} y1={p.endY - 7} y2={p.endY + 7}
              stroke={color(p.o)} strokeWidth="2" />
          ))}
          {geo.paths.filter((p) => p.o === "o").map((p, i) => (
            <line key={`o${i}`} x1={xEnd - 7} x2={xEnd + 7} y1={p.endY} y2={p.endY} stroke={OPEN} strokeWidth="2" opacity="0.85" />
          ))}
          <path d={`M${xEnd + 14},${yT} h6 V${yS} h-6`} fill="none" stroke="white" strokeOpacity="0.35" />
          <text x={xEnd + 26} y={(yT + yS) / 2 - 4} fill={OPEN} fontSize="22" fontWeight="800">Still</text>
          <text x={xEnd + 26} y={(yT + yS) / 2 + 22} fill={OPEN} fontSize="22" fontWeight="800">open</text>
        </g>

        <circle cx={geo.x(0)} cy={yE} r="26" fill="url(#tm-glow)" />
        <circle cx={geo.x(0)} cy={yE} r="7" fill="#818cf8" stroke="white" strokeWidth="2" />

        <text x={geo.x(0)} y={H - 10} fill="white" fillOpacity="0.55" fontSize="18" fontFamily="ui-monospace, monospace">
          Today · ${data.entry.toFixed(2)}
        </text>
        <text x={xEnd} y={H - 10} fill="white" fillOpacity="0.9" fontSize="18" fontFamily="ui-monospace, monospace" textAnchor="end">
          +{horizon} sessions
        </text>
      </svg>
      <p className="px-1 text-[10px] text-white/40">
        Showing {sample.length} of {s.paths.toLocaleString()} paths. Each one resamples {data.symbol}'s real daily moves from the past year.
      </p>
    </div>
  );
}
