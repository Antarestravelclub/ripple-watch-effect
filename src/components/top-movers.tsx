import { Suspense, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ChevronDown,
  TrendingUp,
  TrendingDown,
  Shuffle,
  Layers,
  AlertTriangle,
} from "lucide-react";
import type { RippleEvent } from "@/lib/ripple-data";
import {
  MOVERS_WINDOW_HOURS,
  categoryLabel,
  directionLabel,
  eventTickers,
  impactLabel,
  impactTone,
  topMovers,
} from "@/lib/impact";
import { ageLabel } from "@/lib/event-freshness";
import { TickerChip } from "@/components/ticker-chip";
import { EtfBadge } from "@/components/etf-badge";
import { SourceChips } from "@/components/source-chips";
import { EventSignals } from "@/components/event-signals";
import { useEtfTickers } from "@/hooks/use-etf-tickers";
import type { NewsSourceHealth } from "@/lib/live-events.functions";
import type { IngestRun } from "@/hooks/use-live-events";

const STALE_SOURCE_HOURS = 12;

function DirectionIcon({ dir }: { dir: RippleEvent["impactDirection"] }) {
  const cls = "h-3.5 w-3.5";
  if (dir === "risk_on") return <TrendingUp className={cls + " text-tailwind"} />;
  if (dir === "risk_off") return <TrendingDown className={cls + " text-headwind"} />;
  if (dir === "sector_specific") return <Layers className={cls + " text-muted-foreground"} />;
  return <Shuffle className={cls + " text-muted-foreground"} />;
}

export function TopMovers({
  events,
  lastIngest,
  sourceHealth = [],
  isLoading,
}: {
  events: RippleEvent[];
  lastIngest: IngestRun | null;
  sourceHealth?: NewsSourceHealth[];
  isLoading?: boolean;
}) {
  const movers = topMovers(events);
  const feedBroken = Boolean(lastIngest && !lastIngest.ok);
  const staleSources = sourceHealth.filter(
    (s) => s.enabled && (s.staleHours == null || s.staleHours >= STALE_SOURCE_HOURS),
  );

  return (
    <section className="rounded-xl border border-border/70 bg-card/60 p-4 mb-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight">Top 10 Market Movers</h2>
        <span className="text-[11px] text-muted-foreground">
          highest impact · last {MOVERS_WINDOW_HOURS}h
        </span>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Ranked by how materially each story moves markets — context only, not a
        recommendation to invest.
      </p>

      {(feedBroken || staleSources.length > 0) && (
        <div className="mt-3 rounded-lg border border-headwind/50 bg-headwind/10 px-3 py-2 text-[11px]">
          <p className="inline-flex items-center gap-1 text-headwind font-medium">
            <AlertTriangle className="h-3 w-3" />
            {feedBroken ? "Last news refresh failed" : "A news source looks stale"}
          </p>
          {feedBroken && lastIngest?.error && (
            <p className="mt-0.5 text-muted-foreground">{lastIngest.error}</p>
          )}
          {staleSources.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-muted-foreground">
              {staleSources.map((s) => (
                <li key={s.name}>
                  {s.name} —{" "}
                  {s.lastSuccessAt
                    ? `no fresh items for ${Math.round(s.staleHours ?? 0)}h`
                    : "has never delivered items"}
                  {s.lastError ? ` (${s.lastError})` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {isLoading ? (
        <p className="mt-3 text-xs text-muted-foreground">Loading the impact ranking…</p>
      ) : movers.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          No high-impact events in the last {MOVERS_WINDOW_HOURS}h.
        </p>
      ) : (
        <ol className="mt-3 space-y-2">
          {movers.map((e, i) => (
            <MoverRow key={e.id} event={e} rank={i + 1} />
          ))}
        </ol>
      )}
    </section>
  );
}

function MoverRow({ event, rank }: { event: RippleEvent; rank: number }) {
  const [open, setOpen] = useState(false);
  const { instrumentOf } = useEtfTickers();
  const score = event.impactScore ?? 0;
  const tickers = eventTickers(event);

  return (
    <li className="rounded-lg border border-border/50 bg-background/30">
      {/* Not a <button>: the row contains clickable ticker chips. */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
        aria-expanded={open}
        className="w-full cursor-pointer text-left p-2.5 flex items-start gap-3 hover:bg-accent/30 rounded-lg transition-colors"
      >
        <span className="mt-0.5 w-6 shrink-0 text-center font-mono text-xs text-muted-foreground">
          {rank}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 flex-wrap">
            <span
              className={"text-[10px] font-mono px-1.5 py-0.5 rounded-full border " + impactTone(score)}
              title={impactLabel(score)}
            >
              {score}
            </span>
            <span
              className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"
              title={directionLabel(event.impactDirection)}
            >
              <DirectionIcon dir={event.impactDirection} />
              {directionLabel(event.impactDirection)}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-border/60 bg-background/60 text-muted-foreground">
              {categoryLabel(event.impactCategory ?? event.category)}
            </span>
            <SourceChips sources={event.sources} />
            <span className="ml-auto text-[10px] text-muted-foreground/80">
              {ageLabel(event.publishedAt)}
            </span>
          </span>
          <span className="mt-1.5 block text-sm font-medium leading-snug">
            {event.headline}
          </span>
          {tickers.length > 0 && (
            <span className="mt-1.5 flex flex-wrap gap-1.5">
              {tickers.map((t) => (
                <span key={t} className="inline-flex items-center">
                  <TickerChip ticker={t} />
                  <EtfBadge type={instrumentOf(t)} />
                </span>
              ))}
            </span>
          )}
        </span>
        <ChevronDown
          className={"mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform " + (open ? "rotate-180" : "")}
        />
      </div>

      {open && (
        <div className="border-t border-border/40 px-3 py-2.5">
          <p className="text-xs text-muted-foreground">
            {event.impactReasoning || event.whyMarketsCare}
          </p>
          <Suspense fallback={null}>
            <EventSignals eventId={event.id} strength={event.strength} />
          </Suspense>
          <Link
            to="/event/$id"
            params={{ id: event.id }}
            className="mt-2 inline-block text-[11px] text-primary hover:underline"
          >
            Open full event breakdown
          </Link>
        </div>
      )}
    </li>
  );
}
