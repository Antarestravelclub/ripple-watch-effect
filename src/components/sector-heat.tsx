import { GICS_SECTORS, sectorHeat, type RippleEvent } from "@/lib/ripple-data";

export function SectorHeat({ events }: { events: RippleEvent[] }) {
  const heat = sectorHeat(events);
  const max = Math.max(1, ...Object.values(heat));

  return (
    <div className="rounded-xl border border-border/70 bg-card/60 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Sector Heat</h3>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Today
        </span>
      </div>
      <ul className="space-y-1.5">
        {GICS_SECTORS.map((s) => {
          const n = heat[s] ?? 0;
          const intensity = n / max;
          return (
            <li
              key={s}
              className="flex items-center justify-between text-xs rounded-md px-2 py-1.5 border border-border/40"
              style={{
                background: `color-mix(in oklab, var(--color-primary) ${
                  intensity * 22
                }%, transparent)`,
              }}
            >
              <span className="truncate pr-2 text-foreground/90">{s}</span>
              <span className="text-muted-foreground tabular-nums">{n}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
        Count of today's events with exposure touching each GICS sector.
      </p>
    </div>
  );
}
