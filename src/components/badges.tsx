import type { EventCategory, RippleStrength } from "@/lib/ripple-data";

const CATEGORY_COLOR: Record<EventCategory, string> = {
  Geopolitical: "bg-red-500/15 text-red-300 border-red-500/30",
  "Central Bank": "bg-blue-500/15 text-blue-300 border-blue-500/30",
  Commodity: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  Regulation: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  Tech: "bg-teal-500/15 text-teal-300 border-teal-500/30",
  "Weather/Disaster": "bg-orange-500/15 text-orange-300 border-orange-500/30",
};

export function CategoryBadge({ category }: { category: EventCategory }) {
  return (
    <span
      className={
        "text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full border " +
        CATEGORY_COLOR[category]
      }
    >
      {category}
    </span>
  );
}

export function StrengthPill({ strength }: { strength: RippleStrength }) {
  const map: Record<RippleStrength, { dots: number; label: string; tone: string }> = {
    Low: { dots: 1, label: "Low", tone: "text-muted-foreground" },
    Medium: { dots: 2, label: "Medium", tone: "text-foreground" },
    High: { dots: 3, label: "High", tone: "text-primary" },
  };
  const v = map[strength];
  return (
    <span
      className={
        "inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full border border-border/60 bg-background/60 " +
        v.tone
      }
      title={`${strength} market relevance`}
    >
      <span className="inline-flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={
              "w-1 h-1 rounded-full " +
              (i < v.dots ? "bg-primary" : "bg-muted-foreground/30")
            }
          />
        ))}
      </span>
      {v.label} ripple
    </span>
  );
}
