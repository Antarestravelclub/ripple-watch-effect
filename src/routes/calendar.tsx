import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteShell } from "@/components/site-shell";
import { getQuotes } from "@/lib/quotes.functions";
import { REGIONS, type RegionCode } from "@/lib/ripple-regions";
import {
  WORLD_EVENTS,
  CALENDAR_CATEGORIES,
  type CalendarCategory,
} from "@/lib/world-calendar";

export const Route = createFileRoute("/calendar")({
  head: () => ({
    meta: [
      { title: "World Event Calendar — The Ripple Effect" },
      {
        name: "description",
        content:
          "A forward calendar of scheduled global market events — central bank decisions, data releases, OPEC meetings and summits — with the tickers historically most exposed to each.",
      },
      { property: "og:title", content: "World Event Calendar — The Ripple Effect" },
      {
        property: "og:description",
        content:
          "Scheduled world events by region and category, with live quotes for the tickers most exposed to each catalyst.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CalendarPage,
});

function monthLabel(iso: string) {
  return new Date(iso + "T00:00:00Z").toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function dayLabel(iso: string) {
  const d = new Date(iso + "T00:00:00Z");
  return {
    day: d.toLocaleDateString(undefined, { day: "2-digit", timeZone: "UTC" }),
    weekday: d.toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" }),
  };
}

function CalendarPage() {
  const [region, setRegion] = useState<RegionCode | "ALL">("ALL");
  const [category, setCategory] = useState<CalendarCategory | "ALL">("ALL");

  const events = useMemo(
    () =>
      [...WORLD_EVENTS]
        .filter((e) => region === "ALL" || e.region === region || e.region === "GLOBAL")
        .filter((e) => category === "ALL" || e.category === category)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [region, category],
  );

  const tickers = useMemo(
    () => Array.from(new Set(events.flatMap((e) => e.watch))).slice(0, 25),
    [events],
  );

  const fetchQuotes = useServerFn(getQuotes);
  const { data } = useQuery({
    queryKey: ["quotes", "calendar", tickers.join(",")],
    queryFn: () => fetchQuotes({ data: { tickers } }),
    enabled: tickers.length > 0,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const groups = useMemo(() => {
    const map = new Map<string, typeof events>();
    for (const e of events) {
      const key = e.date.slice(0, 7);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return [...map.entries()];
  }, [events]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <SiteShell>
      <div className="mb-4">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          World event calendar
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Scheduled global catalysts by region, with the tickers historically most
          exposed to each — live prices refresh every 60 seconds.
        </p>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        <FilterChip active={region === "ALL"} onClick={() => setRegion("ALL")}>
          🌍 All regions
        </FilterChip>
        {REGIONS.filter((r) => r.code !== "GLOBAL").map((r) => (
          <FilterChip
            key={r.code}
            active={region === r.code}
            onClick={() => setRegion(r.code)}
          >
            {r.flag} {r.label}
          </FilterChip>
        ))}
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <FilterChip active={category === "ALL"} onClick={() => setCategory("ALL")}>
          All types
        </FilterChip>
        {CALENDAR_CATEGORIES.map((c) => (
          <FilterChip key={c} active={category === c} onClick={() => setCategory(c)}>
            {c}
          </FilterChip>
        ))}
      </div>

      {groups.length === 0 ? (
        <div className="rounded-xl border border-border/70 bg-card/60 p-8 text-center text-sm text-muted-foreground">
          No scheduled events match those filters.
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(([key, list]) => (
            <section key={key}>
              <h2 className="text-sm font-semibold tracking-tight mb-2 text-muted-foreground">
                {monthLabel(list[0].date)}
              </h2>
              <div className="grid gap-2">
                {list.map((e) => {
                  const { day, weekday } = dayLabel(e.date);
                  const upcoming = e.date >= today;
                  const region = REGIONS.find((r) => r.code === e.region);
                  return (
                    <article
                      key={e.id}
                      className={
                        "rounded-xl border bg-card/60 p-4 flex gap-4 " +
                        (upcoming ? "border-border/70" : "border-border/40 opacity-70")
                      }
                    >
                      <div className="text-center min-w-[46px]">
                        <div className="text-xl font-semibold leading-none tabular-nums">
                          {day}
                        </div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
                          {weekday}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">
                            {e.category}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {region?.flag} {region?.label}
                          </span>
                        </div>
                        <h3 className="mt-2 text-base font-semibold leading-snug">
                          {e.title}
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">{e.why}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {e.watch.map((t) => {
                            const q = data?.quotes?.[t] ?? null;
                            const pct = q?.changePct ?? null;
                            return (
                              <span
                                key={t}
                                className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background/40 px-2 py-1 text-[11px]"
                              >
                                <span className="font-semibold tracking-wide">{t}</span>
                                {q ? (
                                  <>
                                    <span className="text-muted-foreground tabular-nums">
                                      ${q.price.toFixed(2)}
                                    </span>
                                    <span
                                      className={
                                        "tabular-nums " +
                                        (pct && pct > 0
                                          ? "text-tailwind"
                                          : pct && pct < 0
                                            ? "text-headwind"
                                            : "text-muted-foreground")
                                      }
                                    >
                                      {pct !== null
                                        ? `${pct > 0 ? "+" : ""}${pct.toFixed(2)}%`
                                        : "—"}
                                    </span>
                                  </>
                                ) : null}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <p className="mt-6 text-[11px] text-muted-foreground/80">
        Scheduled dates may be revised by the issuing body. Quotes are delayed. This is
        exposure context for research — not a prediction or investment advice.
      </p>
    </SiteShell>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "text-xs px-3 py-1.5 rounded-full border transition-colors " +
        (active
          ? "bg-primary/15 text-primary border-primary/40"
          : "border-border/70 text-muted-foreground hover:text-foreground hover:bg-accent")
      }
    >
      {children}
    </button>
  );
}
