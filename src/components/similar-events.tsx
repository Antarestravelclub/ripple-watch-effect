import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listAnalogues } from "@/lib/analogues.functions";
import type {
  Archetype,
  HistoricalEventRow,
  HistoricalReactionRow,
} from "@/lib/analogues.functions";
import { AnalogueCard } from "./analogue-card";
import { Link } from "@tanstack/react-router";

export function SimilarEvents({
  archetypes,
  limit = 5,
}: {
  archetypes: Archetype[];
  limit?: number;
}) {
  const fetchFn = useServerFn(listAnalogues);
  const [events, setEvents] = useState<HistoricalEventRow[]>([]);
  const [reactions, setReactions] = useState<HistoricalReactionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchFn({ data: { archetypes, limit } })
      .then((res) => {
        if (cancelled) return;
        setEvents(res.events);
        setReactions(res.reactions);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [archetypes.join(","), limit, fetchFn]);

  if (loading) {
    return <div className="text-xs text-muted-foreground">Loading analogues…</div>;
  }
  if (events.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">
        No historical analogues catalogued yet for this archetype.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {events.map((ev) => (
        <AnalogueCard
          key={ev.id}
          event={ev}
          reactions={reactions.filter((r) => r.historical_event_id === ev.id)}
        />
      ))}
      <div className="text-right">
        <Link
          to="/analogues"
          className="text-xs text-primary hover:underline"
        >
          Browse full analogue library →
        </Link>
      </div>
    </div>
  );
}
