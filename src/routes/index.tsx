import { createFileRoute } from "@tanstack/react-router";
import { SiteShell } from "@/components/site-shell";
import { EventCard } from "@/components/event-card";
import { EVENTS } from "@/lib/ripple-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Today's Ripples — The Ripple Effect" },
      {
        name: "description",
        content:
          "A daily map of world events and the stocks and sectors they mechanically affect. Educational market exposure, not investment advice.",
      },
      { property: "og:title", content: "Today's Ripples — The Ripple Effect" },
      {
        property: "og:description",
        content:
          "Map world events to the sectors and tickers they touch. Exposure and historical context, not price predictions.",
      },
    ],
  }),
  component: TodayPage,
});

function TodayPage() {
  const events = [...EVENTS].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );

  return (
    <SiteShell>
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          Today's Ripples
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          World events, mapped to the sectors and tickers they mechanically
          touch.
        </p>
      </div>
      <div className="grid gap-3">
        {events.map((e) => (
          <EventCard key={e.id} event={e} />
        ))}
      </div>
    </SiteShell>
  );
}
