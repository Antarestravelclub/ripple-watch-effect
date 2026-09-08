import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { TrendingUp, TrendingDown, ChevronDown, Newspaper } from "lucide-react";
import { listSignals } from "@/lib/signals.functions";
import { getLatestPrices, type PriceFeedRun } from "@/lib/prices.functions";
import { fmtPct, fmtPrice, pctTone } from "@/lib/signal-metrics";
import { useLiveEvents } from "@/hooks/use-live-events";
import { CategoryBadge } from "@/components/badges";
import { TickerLink } from "@/components/ticker-link";
import { ageLabel } from "@/lib/event-freshness";
import { REGIONS, eventRegions } from "@/lib/ripple-regions";
import type { RippleEvent } from "@/lib/ripple-data";

interface Mover {
  id: string;
  ticker: string;
  price: number;
  pct: number;
  direction: "long" | "short";
  eventId: string;
}

interface EventGroup {
  event: RippleEvent | null;
  eventId: string;
  movers: Mover[];
}

/** Snapshots older than this are treated as stale and excluded. */
const MAX_SNAPSHOT_AGE_MS = 24 * 60 * 60 * 1000;

export function MarketMovers() {
  const list = useServerFn(listSignals);
  const prices = useServerFn(getLatestPrices);
  const { events: liveEvents } = useLiveEvents();

  const { data, isLoading } = useQuery({
    queryKey: ["signals", "all"],
    queryFn: () => list(),
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  // Single shared price store — this panel never calls the data provider.
  const { data: feed } = useQuery({
    queryKey: ["latest-prices"],
    queryFn: () => prices(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const eventById = useMemo(() => {
    const m = new Map<string, RippleEvent>();
    for (const e of liveEvents) m.set(e.id, e);
    return m;
  }, [liveEvents]);

  // Only open signals with a recent snapshot qualify as "live" moves.
  const tracked = useMemo(() => {
    const cutoff = Date.now() - MAX_SNAPSHOT_AGE_MS;
    return (data?.signals ?? []).filter((s) => {
      if (s.status !== "open" || !s.signal_price) return false;
      const snap = data?.latest[s.id];
      if (!snap) return false;
      return new Date(snap.captured_at).getTime() >= cutoff;
    });
  }, [data]);

  const { gainers, decliners } = useMemo(() => {
    const byTicker = new Map<string, Mover>();
    for (const s of tracked) {
      const symbol = (s.quote_symbol || s.ticker).toUpperCase();
      const price = feed?.prices[symbol]?.price ?? data?.latest[s.id]?.price;
      if (price == null || !s.signal_price) continue;
      const pct = ((price - s.signal_price) / s.signal_price) * 100;
      if (!isFinite(pct)) continue;
      if (!byTicker.has(s.ticker))
        byTicker.set(s.ticker, {
          id: s.id,
          ticker: s.ticker,
          price,
          pct,
          direction: s.direction === "short" ? "short" : "long",
          eventId: s.event_id,
        });
    }
    const all = [...byTicker.values()];
    return {
      gainers: all.filter((m) => m.pct > 0).sort((a, b) => b.pct - a.pct).slice(0, 6),
      decliners: all.filter((m) => m.pct < 0).sort((a, b) => a.pct - b.pct).slice(0, 6),
    };
  }, [tracked, feed, data]);

  const groupsFor = (movers: Mover[]): EventGroup[] => {
    const order: string[] = [];
    const map = new Map<string, Mover[]>();
    for (const m of movers) {
      if (!map.has(m.eventId)) {
        map.set(m.eventId, []);
        order.push(m.eventId);
      }
      map.get(m.eventId)!.push(m);
    }
    return order.map((id) => ({
      eventId: id,
      event: eventById.get(id) ?? null,
      movers: map.get(id)!,
    }));
  };

  const empty = !isLoading && gainers.length === 0 && decliners.length === 0;
  const lastRun = feed?.lastRun ?? null;
  const feedBlocked = Boolean(lastRun && (!lastRun.ok || lastRun.rateLimited > 0));

  // Timestamp of the newest stored price, so a stale feed is visibly different
  // from the market simply being closed.
  const lastPriceAt = useMemo(() => {
    let newest = 0;
    for (const p of Object.values(feed?.prices ?? {})) {
      const t = p.quoteTime ? new Date(p.quoteTime).getTime() : new Date(p.fetchTime).getTime();
      if (t > newest) newest = t;
    }
    return newest || null;
  }, [feed]);

  const newestEvents = useMemo(
    () =>
      [...liveEvents]
        .sort(
          (a, b) =>
            new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
        )
        .slice(0, 3),
    [liveEvents],
  );

  return (
    <section className="rounded-xl border border-border/70 bg-card/60 p-4 mb-5">
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <h2 className="text-sm font-semibold tracking-tight">
          Market moves — driven by today's events
        </h2>
        <span className="text-[11px] text-muted-foreground">
          delayed
          {" · "}
          {lastPriceAt
            ? `last price ${new Date(lastPriceAt).toLocaleTimeString()}`
            : "no price received yet"}
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground mb-3">
        Move since each ticker was flagged, grouped under the world event that
        flagged it · open signals only
      </p>

      <FeedDiagnostics
        run={lastRun}
        runs={feed?.runs ?? []}
        successRate={feed?.successRate ?? null}
        storedSymbols={Object.keys(feed?.prices ?? {}).length}
        blocked={feedBlocked}
      />

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading price moves…</p>
      ) : empty ? (
        <div className="text-xs text-muted-foreground">
          <p>
            No fresh moves to show yet —{" "}
            {feedBlocked
              ? "the last price update did not complete (open Feed status below for the exact error)"
              : "waiting for the next price update"}
            . Tickers appear here once a current price arrives for an open signal.
          </p>
          {newestEvents.length > 0 && (
            <div className="mt-2">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground/70 mb-1">
                Newest events
              </div>
              <ul className="space-y-1">
                {newestEvents.map((e) => (
                  <li key={e.id}>
                    <Link
                      to="/event/$id"
                      params={{ id: e.id }}
                      className="hover:text-foreground transition-colors"
                    >
                      {e.headline}{" "}
                      <span className="text-muted-foreground/70">
                        · {ageLabel(e.publishedAt)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <MoverColumn title="Increases" icon="up" groups={groupsFor(gainers)} />
          <MoverColumn title="Drops" icon="down" groups={groupsFor(decliners)} />
        </div>
      )}

      <p className="mt-3 text-[11px] text-muted-foreground/80">
        Observed movement only — historical context, not a prediction or advice.
      </p>
    </section>
  );
}

function MoverColumn({
  title,
  icon,
  groups,
}: {
  title: string;
  icon: "up" | "down";
  groups: EventGroup[];
}) {
  const Icon = icon === "up" ? TrendingUp : TrendingDown;
  return (
    <div>
      <div
        className={
          "flex items-center gap-1.5 text-xs font-medium mb-2 " +
          (icon === "up" ? "text-tailwind" : "text-headwind")
        }
      >
        <Icon className="w-3.5 h-3.5" />
        {title}
      </div>
      {groups.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">None right now.</p>
      ) : (
        <ul className="space-y-3">
          {groups.map((g) => (
            <li key={g.eventId} className="rounded-lg border border-border/50 bg-background/30 p-2">
              <EventHeader group={g} />
              <ul className="mt-1.5 divide-y divide-border/40">
                {g.movers.map((m) => (
                  <li key={m.ticker}>
                    <Link
                      to="/signal/$id"
                      params={{ id: m.id }}
                      className="flex items-center justify-between gap-3 py-1.5 hover:bg-accent/40 rounded-md px-1 transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <TickerLink symbol={m.ticker} className="font-mono text-xs" />
                        <span
                          className={
                            "text-[10px] uppercase tracking-wider " +
                            (m.direction === "long"
                              ? "text-tailwind"
                              : "text-headwind")
                          }
                        >
                          {m.direction === "long" ? "tailwind" : "headwind"}
                        </span>
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="text-[11px] text-muted-foreground">
                          {fmtPrice(m.price)}
                        </span>
                        <span className={"text-xs font-medium " + pctTone(m.pct)}>
                          {fmtPct(m.pct)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EventHeader({ group }: { group: EventGroup }) {
  const e = group.event;
  if (!e) {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Newspaper className="h-3 w-3 shrink-0" />
        Event no longer in the live feed
      </div>
    );
  }
  const regions = eventRegions(e.id);
  return (
    <div>
      <Link
        to="/event/$id"
        params={{ id: e.id }}
        className="block text-xs font-medium leading-snug hover:text-primary transition-colors"
      >
        {e.headline}
      </Link>
      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
        <CategoryBadge category={e.category} />
        {regions.map((code) => {
          const r = REGIONS.find((x) => x.code === code);
          return r ? (
            <span
              key={code}
              className="text-[10px] px-1.5 py-0.5 rounded-full border border-border/60 bg-background/60 text-muted-foreground"
              title={r.label}
            >
              {r.flag} {r.code}
            </span>
          ) : null;
        })}
        <span className="text-[10px] text-muted-foreground/70">
          {ageLabel(e.publishedAt)}
        </span>
      </div>
    </div>
  );
}

function timeOrDash(iso: string | null | undefined) {
  return iso ? new Date(iso).toLocaleTimeString() : "—";
}

function FeedDiagnostics({
  run,
  runs,
  successRate,
  storedSymbols,
  blocked,
}: {
  run: PriceFeedRun | null;
  runs: PriceFeedRun[];
  successRate: number | null;
  storedSymbols: number;
  blocked: boolean;
}) {
  const [open, setOpen] = useState(false);
  const expanded = open || blocked;
  const rateLimited = runs.reduce((n, r) => n + r.rateLimited, 0);
  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={
          "inline-flex items-center gap-1 text-[11px] rounded-md border px-2 py-1 transition-colors " +
          (blocked
            ? "border-headwind/50 bg-headwind/10 text-headwind"
            : "border-border/60 text-muted-foreground hover:text-foreground")
        }
      >
        <ChevronDown
          className={"h-3 w-3 transition-transform " + (expanded ? "rotate-180" : "")}
        />
        Feed status
        {blocked ? " — price update failed" : ""}
      </button>
      {expanded && (
        <div
          className={
            "mt-2 rounded-lg border px-3 py-2 text-[11px] " +
            (blocked
              ? "border-headwind/50 bg-headwind/10 text-foreground"
              : "border-border/60 bg-background/40 text-muted-foreground")
          }
        >
          <dl className="grid gap-x-4 gap-y-0.5 sm:grid-cols-2">
            <Item label="Source" value={run?.source ?? "—"} />
            <Item label="Last fetch" value={timeOrDash(run?.finishedAt)} />
            <Item
              label="Symbols / requests (last run)"
              value={run ? `${run.symbolsRequested} / ${run.requestsMade}` : "—"}
            />
            <Item
              label="Priced / missed (last run)"
              value={run ? `${run.succeeded} / ${run.failed}` : "—"}
            />
            <Item label="Rate limits (last 10 runs)" value={String(rateLimited)} />
            <Item
              label="Success rate (last 10 runs)"
              value={successRate == null ? "—" : `${successRate}%`}
            />
            <Item label="Symbols stored" value={String(storedSymbols)} />
          </dl>
          {run?.error ? (
            <p className="mt-1 font-mono text-headwind">Last error: {run.error}</p>
          ) : null}
        </div>
      )}
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt>{label}</dt>
      <dd className="font-mono">{value}</dd>
    </div>
  );
}
