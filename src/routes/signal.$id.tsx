import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteShell } from "@/components/site-shell";
import { Sparkline } from "@/components/sparkline";
import { getSignal } from "@/lib/signals.functions";
import { computeMetrics, fmtPct, fmtPrice, pctTone } from "@/lib/signal-metrics";
import { useLiveEvents } from "@/hooks/use-live-events";
import { ArrowLeft, Clock } from "lucide-react";

export const Route = createFileRoute("/signal/$id")({
  head: () => ({
    meta: [
      { title: "Tracked signal — The Ripple Effect" },
      {
        name: "description",
        content:
          "Educational tracking of a hypothetical stock signal linked to a world event. Delayed prices, no investment advice.",
      },
      { property: "og:title", content: "Tracked signal — The Ripple Effect" },
      {
        property: "og:description",
        content: "Observed price behaviour vs. a signal, target and invalidation.",
      },
    ],
  }),
  component: SignalDetail,
});

function SignalDetail() {
  const { id } = Route.useParams();
  const fetcher = useServerFn(getSignal);
  const { data } = useSuspenseQuery({
    queryKey: ["signal", id],
    queryFn: () => fetcher({ data: { id } }),
    staleTime: 30_000,
  });

  if (!data.signal) throw notFound();
  const signal = data.signal;
  const { events } = useLiveEvents();
  const event = events.find((e) => e.id === signal.event_id);
  const metrics = computeMetrics(signal, data.snapshots);

  const dirTone =
    signal.direction === "long"
      ? "bg-tailwind/15 text-tailwind border-tailwind/30"
      : "bg-headwind/15 text-headwind border-headwind/30";

  return (
    <SiteShell>
      <Link
        to="/tracker"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to tracker
      </Link>

      <div className="rounded-xl border border-border/70 bg-card/60 p-5 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={"text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md border " + dirTone}>
            {signal.direction === "long" ? "Long thesis" : "Short / avoid"}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Conviction {signal.conviction}/5 · {signal.generated_by}
          </span>
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            <Clock className="w-3 h-3" />
            Delayed prices · {metrics.daysOpen}d observed
          </span>
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight font-mono">
          {signal.ticker}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{signal.rationale}</p>
        {event && (
          <Link
            to="/event/$id"
            params={{ id: event.id }}
            className="mt-3 inline-block text-xs text-primary hover:underline"
          >
            Triggered by: {event.headline}
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Stat label="Signal price" value={fmtPrice(signal.signal_price)} />
        <Stat
          label="Current"
          value={fmtPrice(metrics.currentPrice)}
          tone={pctTone(metrics.currentPct)}
          sub={fmtPct(metrics.currentPct)}
        />
        <Stat
          label="Running high"
          value={fmtPrice(metrics.runningHigh)}
          sub={metrics.runningHighAt ? new Date(metrics.runningHighAt).toLocaleDateString() : undefined}
        />
        <Stat
          label="Running low"
          value={fmtPrice(metrics.runningLow)}
          sub={metrics.runningLowAt ? new Date(metrics.runningLowAt).toLocaleDateString() : undefined}
        />
      </div>

      <div className="rounded-xl border border-border/70 bg-card/60 p-4 mb-4">
        <Sparkline
          snapshots={data.snapshots}
          signalPrice={signal.signal_price}
          targetPrice={signal.target_price}
          invalidationPrice={signal.invalidation_price}
          direction={signal.direction}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Stat
          label="Max favourable"
          value={fmtPct(metrics.mfePct)}
          sub={fmtPrice(metrics.mfeDollar)}
          tone="text-tailwind"
        />
        <Stat
          label="Max adverse"
          value={fmtPct(metrics.maePct == null ? null : -Math.abs(metrics.maePct))}
          sub={metrics.maeDollar == null ? undefined : "-" + fmtPrice(Math.abs(metrics.maeDollar))}
          tone="text-headwind"
        />
        <Stat
          label="Target touched"
          value={metrics.touchedTarget ? "Yes" : "No"}
          tone={metrics.touchedTarget ? "text-tailwind" : undefined}
        />
        <Stat
          label="Invalidation touched"
          value={metrics.touchedInvalidation ? "Yes" : "No"}
          tone={metrics.touchedInvalidation ? "text-headwind" : undefined}
        />
      </div>

      <div className="rounded-lg border border-border/60 bg-background/40 p-3 text-[11px] text-muted-foreground italic">
        Educational research tool. Prices are delayed. Nothing here is a
        recommendation to buy or sell — this page shows observed historical
        correlation between an event and a ticker, tracked hypothetically.
      </div>
    </SiteShell>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={"mt-1 text-lg font-mono tabular-nums " + (tone ?? "text-foreground")}>
        {value}
      </div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}
