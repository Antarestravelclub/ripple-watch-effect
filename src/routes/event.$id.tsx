import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { SiteShell } from "@/components/site-shell";
import { EVENTS, type ExposureSector, type HistoricalEcho } from "@/lib/ripple-data";
import { CategoryBadge, StrengthPill } from "@/components/badges";
import { TickerChip } from "@/components/ticker-chip";
import { ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";

export const Route = createFileRoute("/event/$id")({
  loader: ({ params }) => {
    const event = EVENTS.find((e) => e.id === params.id);
    if (!event) throw notFound();
    return { event };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Event not found — The Ripple Effect" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const { event } = loaderData;
    return {
      meta: [
        { title: `${event.headline} — The Ripple Effect` },
        { name: "description", content: event.whyMarketsCare },
        { property: "og:title", content: event.headline },
        { property: "og:description", content: event.whyMarketsCare },
      ],
    };
  },
  component: EventDetail,
});

function ExposureColumn({
  title,
  tone,
  groups,
}: {
  title: string;
  tone: "tailwind" | "headwind";
  groups: ExposureSector[];
}) {
  const Icon = tone === "tailwind" ? TrendingUp : TrendingDown;
  const toneColor = tone === "tailwind" ? "text-tailwind" : "text-headwind";
  const dot = tone === "tailwind" ? "bg-tailwind" : "bg-headwind";

  return (
    <div className="rounded-xl border border-border/70 bg-card/60 p-4">
      <div className={"flex items-center gap-2 mb-3 " + toneColor}>
        <span className={"w-2 h-2 rounded-full " + dot} />
        <Icon className="w-4 h-4" />
        <h3 className="text-sm font-semibold uppercase tracking-wider">
          {title}
        </h3>
      </div>
      <div className="space-y-4">
        {groups.map((g, i) => (
          <div key={i} className="border-t border-border/50 pt-3 first:border-t-0 first:pt-0">
            <div className="text-sm font-medium text-foreground">{g.sector}</div>
            <p className="text-xs text-muted-foreground mt-1">{g.mechanism}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {g.tickers.map((t) => (
                <TickerChip key={t} ticker={t} tone={tone} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EventDetail() {
  const { event } = Route.useLoaderData();

  return (
    <SiteShell>
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to today
      </Link>

      <div className="rounded-xl border border-border/70 bg-card/60 p-5 mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <CategoryBadge category={event.category} />
          <StrengthPill strength={event.strength} />
          <span className="ml-auto text-xs text-muted-foreground">
            {event.source}
          </span>
        </div>
        <h1 className="mt-3 text-xl sm:text-2xl font-semibold tracking-tight">
          {event.headline}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {event.whyMarketsCare}
        </p>
      </div>

      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Exposure Map
      </h2>
      <div className="grid md:grid-cols-2 gap-4">
        <ExposureColumn
          title="Likely Tailwind"
          tone="tailwind"
          groups={event.tailwinds}
        />
        <ExposureColumn
          title="Likely Headwind"
          tone="headwind"
          groups={event.headwinds}
        />
      </div>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Historical Echoes
      </h2>
      <div className="space-y-3">
        {event.historicalEchoes.map((h: HistoricalEcho, i: number) => (
          <div
            key={i}
            className="rounded-xl border border-border/70 bg-card/60 p-4"
          >
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-xs font-medium uppercase tracking-wider text-primary">
                {h.date}
              </span>
              <span className="text-sm text-foreground">{h.event}</span>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="text-left font-medium py-1.5">Sector</th>
                    <th className="text-right font-medium py-1.5">1d</th>
                    <th className="text-right font-medium py-1.5">5d</th>
                    <th className="text-right font-medium py-1.5">30d</th>
                  </tr>
                </thead>
                <tbody>
                  {h.outcomes.map((o: HistoricalEcho["outcomes"][number], j: number) => (
                    <tr key={j} className="border-t border-border/40">
                      <td className="py-1.5 pr-2">{o.sector}</td>
                      <PctCell v={o.d1} />
                      <PctCell v={o.d5} />
                      <PctCell v={o.d30} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-6 text-[11px] text-muted-foreground italic">
        Historical outcomes are illustrative context, not forecasts. Past
        results do not indicate future performance.
      </p>
    </SiteShell>
  );
}

function PctCell({ v }: { v: number }) {
  const tone =
    v > 0 ? "text-tailwind" : v < 0 ? "text-headwind" : "text-muted-foreground";
  return (
    <td className={"py-1.5 text-right tabular-nums font-mono " + tone}>
      {v > 0 ? "+" : ""}
      {v.toFixed(1)}%
    </td>
  );
}
