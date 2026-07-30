import { useState } from "react";
import { sectorPressure, type RippleEvent } from "@/lib/ripple-data";

export function SectorHeat({ events }: { events: RippleEvent[] }) {
  const rows = sectorPressure(events);
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.net)));
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="rounded-xl border border-border/70 bg-card/60 p-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold">Sector Pressure</h3>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Today
        </span>
      </div>
      <div className="mb-2 flex items-center justify-between text-[10px] text-muted-foreground">
        <span className="text-headwind">◀ net short</span>
        <span className="text-tailwind">net long ▶</span>
      </div>
      <ul className="space-y-1">
        {rows.map((r) => {
          const pct = (Math.abs(r.net) / max) * 50;
          const positive = r.net > 0;
          const active = open === r.sector;
          return (
            <li key={r.sector}>
              <button
                type="button"
                onClick={() => setOpen(active ? null : r.sector)}
                title={`${r.sector}: ${r.tailwind} tailwind / ${r.headwind} headwind (net ${
                  r.net > 0 ? "+" : ""
                }${r.net})`}
                className="w-full text-left rounded-md px-2 py-1 hover:bg-accent/40 transition-colors"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="truncate pr-2 text-foreground/90">{r.sector}</span>
                  <span
                    className={
                      "tabular-nums text-[11px] " +
                      (r.net > 0
                        ? "text-tailwind"
                        : r.net < 0
                          ? "text-headwind"
                          : "text-muted-foreground")
                    }
                  >
                    {r.net > 0 ? "+" : ""}
                    {r.net}
                  </span>
                </div>
                <div className="relative mt-1 h-1.5 rounded-full bg-muted/40">
                  <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
                  {r.net !== 0 && (
                    <div
                      className={
                        "absolute inset-y-0 rounded-full " +
                        (positive ? "bg-tailwind" : "bg-headwind")
                      }
                      style={
                        positive
                          ? { left: "50%", width: `${pct}%` }
                          : { right: "50%", width: `${pct}%` }
                      }
                    />
                  )}
                </div>
                {active && (
                  <div className="mt-1 text-[10px] text-muted-foreground tabular-nums">
                    <span className="text-tailwind">{r.tailwind} tailwind</span>
                    {" · "}
                    <span className="text-headwind">{r.headwind} headwind</span>
                  </div>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
        Net directional pressure: tailwind ticker signals minus headwind ticker signals across
        today's events. Tap a sector for raw counts.
      </p>
    </div>
  );
}
