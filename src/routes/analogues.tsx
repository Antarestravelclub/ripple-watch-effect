import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { SiteShell } from "@/components/site-shell";
import { AnalogueCard } from "@/components/analogue-card";
import {
  listAnalogues,
  type Archetype,
  type HistoricalEventRow,
  type HistoricalReactionRow,
} from "@/lib/analogues.functions";
import { ARCHETYPE_LABEL } from "@/lib/analogue-mapping";
import { Search } from "lucide-react";

export const Route = createFileRoute("/analogues")({
  head: () => ({
    meta: [
      { title: "Historical Analogues — The Ripple Effect" },
      {
        name: "description",
        content:
          "Browse a catalogue of past events by archetype and the specific stocks that moved — losers, direct winners, and substitute winners.",
      },
      { property: "og:title", content: "Historical Analogues — The Ripple Effect" },
      {
        property: "og:description",
        content:
          "How past shocks moved specific stocks — direct losers, direct winners, and substitute winners with time windows and reversion.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AnaloguesPage,
});

const ARCHETYPES: Archetype[] = [
  "armed_conflict",
  "terror_attack",
  "natural_disaster",
  "industrial_accident",
  "regulatory_action",
  "supply_chain_disruption",
  "political_instability",
  "pandemic_health",
  "cyber_attack",
  "commodity_shock",
];

function AnaloguesPage() {
  const fetchFn = useServerFn(listAnalogues);
  const [events, setEvents] = useState<HistoricalEventRow[]>([]);
  const [reactions, setReactions] = useState<HistoricalReactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [archetype, setArchetype] = useState<Archetype | "all">("all");
  const [direction, setDirection] = useState<"all" | "up" | "down">("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchFn({ data: {} })
      .then((res) => {
        if (cancelled) return;
        setEvents(res.events);
        setReactions(res.reactions);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [fetchFn]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((ev) => {
      if (archetype !== "all" && ev.archetype !== archetype) return false;
      const evReactions = reactions.filter((r) => r.historical_event_id === ev.id);
      if (direction !== "all" && !evReactions.some((r) => r.direction === direction))
        return false;
      if (q) {
        const inTitle = ev.title.toLowerCase().includes(q);
        const inTicker = evReactions.some(
          (r) =>
            r.ticker.toLowerCase().includes(q) ||
            (r.company_name ?? "").toLowerCase().includes(q),
        );
        if (!inTitle && !inTicker) return false;
      }
      return true;
    });
  }, [events, reactions, archetype, direction, query]);

  return (
    <SiteShell>
      <header className="mb-5">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
          Historical Analogues
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A library of past events and the specific stocks that moved. Educational
          context — not a prediction of what happens next.
        </p>
      </header>

      <div className="rounded-xl border border-border/70 bg-card/60 p-3 mb-4 flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title or ticker"
            className="w-full text-xs pl-8 pr-2 py-1.5 rounded-md bg-background/70 border border-border/60 focus:outline-none focus:border-primary/40"
          />
        </div>
        <select
          value={archetype}
          onChange={(e) => setArchetype(e.target.value as Archetype | "all")}
          className="text-xs px-2 py-1.5 rounded-md bg-background/70 border border-border/60"
        >
          <option value="all">All archetypes</option>
          {ARCHETYPES.map((a) => (
            <option key={a} value={a}>
              {ARCHETYPE_LABEL[a]}
            </option>
          ))}
        </select>
        <select
          value={direction}
          onChange={(e) => setDirection(e.target.value as "all" | "up" | "down")}
          className="text-xs px-2 py-1.5 rounded-md bg-background/70 border border-border/60"
        >
          <option value="all">Any direction</option>
          <option value="up">Had winners</option>
          <option value="down">Had losers</option>
        </select>
      </div>

      {loading ? (
        <div className="text-xs text-muted-foreground">Loading library…</div>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No events match those filters.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((ev) => (
            <AnalogueCard
              key={ev.id}
              event={ev}
              reactions={reactions.filter((r) => r.historical_event_id === ev.id)}
            />
          ))}
        </div>
      )}
    </SiteShell>
  );
}
