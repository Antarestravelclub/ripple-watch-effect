import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { SiteShell } from "@/components/site-shell";
import {
  listPlaybooks,
  listAnalogues,
  type Archetype,
  type HistoricalEventRow,
  type PlaybookRow,
} from "@/lib/analogues.functions";
import { ARCHETYPE_LABEL } from "@/lib/analogue-mapping";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/playbooks")({
  head: () => ({
    meta: [
      { title: "Archetype Playbooks — The Ripple Effect" },
      {
        name: "description",
        content:
          "Transmission channels for each event archetype — who typically gains, who loses, and how large and how long the move usually is.",
      },
      { property: "og:title", content: "Archetype Playbooks — The Ripple Effect" },
      {
        property: "og:description",
        content:
          "Typical winners, losers, magnitude, and duration for each event archetype, with historical evidence.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlaybooksPage,
});

function ConfidenceMeter({ level }: { level: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={
            "w-1.5 h-3 rounded-sm " +
            (i <= level ? "bg-primary" : "bg-border/60")
          }
        />
      ))}
    </div>
  );
}

function PlaybooksPage() {
  const playbooksFn = useServerFn(listPlaybooks);
  const analoguesFn = useServerFn(listAnalogues);
  const [playbooks, setPlaybooks] = useState<PlaybookRow[]>([]);
  const [events, setEvents] = useState<HistoricalEventRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([playbooksFn(), analoguesFn({ data: {} })])
      .then(([pb, an]) => {
        if (cancelled) return;
        setPlaybooks(pb.playbooks);
        setEvents(an.events);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [playbooksFn, analoguesFn]);

  return (
    <SiteShell>
      <header className="mb-5">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
          Archetype Playbooks
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          For every event archetype: the transmission channel, typical winners and
          losers, and the historical evidence. Educational — not a prediction.
        </p>
      </header>
      {loading ? (
        <div className="text-xs text-muted-foreground">Loading playbooks…</div>
      ) : (
        <div className="space-y-4">
          {playbooks.map((pb) => {
            const evidence = events.filter((e) => e.archetype === pb.archetype);
            return (
              <section
                key={pb.id}
                className="rounded-xl border border-border/70 bg-card/60 p-4"
              >
                <div className="flex items-center gap-3 flex-wrap mb-3">
                  <h2 className="text-sm font-semibold text-foreground">
                    {ARCHETYPE_LABEL[pb.archetype as Archetype]}
                  </h2>
                  <span className="ml-auto flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Confidence
                    <ConfidenceMeter level={pb.confidence} />
                  </span>
                </div>

                <div className="grid md:grid-cols-3 gap-2 mb-3 text-xs">
                  <div className="rounded-lg border border-border/60 bg-background/40 p-2.5">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                      Event
                    </div>
                    <div className="text-foreground">
                      {ARCHETYPE_LABEL[pb.archetype as Archetype]}
                    </div>
                  </div>
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-2.5 relative">
                    <ArrowRight className="w-3.5 h-3.5 text-primary absolute -left-2 top-1/2 -translate-y-1/2 hidden md:block" />
                    <div className="text-[10px] uppercase tracking-wider text-primary mb-1">
                      Channel
                    </div>
                    <div className="text-foreground">{pb.channel}</div>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background/40 p-2.5 relative">
                    <ArrowRight className="w-3.5 h-3.5 text-primary absolute -left-2 top-1/2 -translate-y-1/2 hidden md:block" />
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                      Affected sectors
                    </div>
                    <div className="text-muted-foreground text-[11px]">
                      Winners: {pb.typical_winners.join(", ") || "—"}
                      <br />
                      Losers: {pb.typical_losers.join(", ") || "—"}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-[11px]">
                  <div>
                    <div className="text-muted-foreground uppercase tracking-wider text-[10px] mb-0.5">
                      Typical magnitude
                    </div>
                    <div className="text-foreground">
                      {pb.typical_magnitude_range ?? "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground uppercase tracking-wider text-[10px] mb-0.5">
                      Typical duration
                    </div>
                    <div className="text-foreground">
                      {pb.typical_duration ?? "—"}
                    </div>
                  </div>
                </div>

                {evidence.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-border/50">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                      Historical evidence
                    </div>
                    <ul className="space-y-1">
                      {evidence.map((ev) => (
                        <li
                          key={ev.id}
                          className="text-xs flex items-center gap-2 flex-wrap"
                        >
                          <span className="text-muted-foreground tabular-nums">
                            {new Date(ev.event_date).toLocaleDateString(undefined, {
                              year: "numeric",
                              month: "short",
                            })}
                          </span>
                          <Link
                            to="/analogues"
                            className="text-foreground hover:text-primary"
                          >
                            {ev.title}
                          </Link>
                          {ev.country && (
                            <span className="text-muted-foreground">
                              · {ev.country}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </SiteShell>
  );
}
