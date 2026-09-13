import type { EventSourceLink } from "@/lib/ripple-data";

/** Every news source that reported this story — one event, many sources. */
export function SourceChips({
  sources,
  className = "",
}: {
  sources: EventSourceLink[] | undefined;
  className?: string;
}) {
  if (!sources || sources.length === 0) return null;
  return (
    <span className={"inline-flex items-center gap-1 flex-wrap " + className}>
      {sources.map((s) => {
        const label = s.sourceName || "News feed";
        const chip = (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-border/60 bg-background/60 text-muted-foreground">
            {label}
          </span>
        );
        return s.url ? (
          <a
            key={label}
            href={s.url.startsWith("http") ? s.url : `https://${s.url}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="hover:opacity-80 transition-opacity"
            title={`Open on ${label}`}
          >
            {chip}
          </a>
        ) : (
          <span key={label}>{chip}</span>
        );
      })}
    </span>
  );
}
