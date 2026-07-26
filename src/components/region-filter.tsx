import { REGIONS, type RegionCode } from "@/lib/ripple-regions";

export function RegionFilter({
  selected,
  onChange,
}: {
  selected: RegionCode[];
  onChange: (next: RegionCode[]) => void;
}) {
  function toggle(code: RegionCode) {
    onChange(
      selected.includes(code)
        ? selected.filter((c) => c !== code)
        : [...selected, code],
    );
  }

  return (
    <div className="rounded-xl border border-border/70 bg-card/60 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Filter by region
        </span>
        {selected.length > 0 && (
          <button
            onClick={() => onChange([])}
            className="text-[11px] text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {REGIONS.filter((r) => r.code !== "GLOBAL").map((r) => {
          const active = selected.includes(r.code);
          return (
            <button
              key={r.code}
              onClick={() => toggle(r.code)}
              className={
                "inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors " +
                (active
                  ? "bg-primary/15 text-primary border-primary/40"
                  : "bg-background/40 text-muted-foreground border-border/60 hover:text-foreground hover:border-border")
              }
            >
              <span className="text-sm leading-none">{r.flag}</span>
              {r.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
