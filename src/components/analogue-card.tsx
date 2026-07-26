import { ARCHETYPE_LABEL } from "@/lib/analogue-mapping";
import type {
  HistoricalEventRow,
  HistoricalReactionRow,
} from "@/lib/analogues.functions";
import { ReactionTable } from "./reaction-table";
import { ExternalLink } from "lucide-react";

export function AnalogueCard({
  event,
  reactions,
}: {
  event: HistoricalEventRow;
  reactions: HistoricalReactionRow[];
}) {
  return (
    <article className="rounded-xl border border-border/70 bg-card/60 p-4">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-primary/30 bg-primary/5 text-primary">
          {ARCHETYPE_LABEL[event.archetype]}
        </span>
        <span className="text-[11px] text-muted-foreground">
          {new Date(event.event_date).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </span>
        {event.country && (
          <span className="text-[11px] text-muted-foreground">
            · {event.country}
          </span>
        )}
        <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground/70">
          Historical — not a prediction
        </span>
      </div>
      <h3 className="text-sm font-semibold text-foreground">{event.title}</h3>
      <p className="text-xs text-muted-foreground mt-1">{event.summary}</p>
      <div className="mt-2 text-[11px] text-muted-foreground">
        <span className="text-foreground/80">Channel:</span>{" "}
        {event.transmission_channel}
      </div>
      <div className="mt-3">
        <ReactionTable rows={reactions} />
      </div>
      {event.source_url && (
        <a
          href={event.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
        >
          Source <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </article>
  );
}
