import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listSignalsForEvent } from "@/lib/signals.functions";
import { SignalBadge } from "./signal-badge";

export function EventSignals({ eventId }: { eventId: string }) {
  const fetcher = useServerFn(listSignalsForEvent);
  const { data } = useSuspenseQuery({
    queryKey: ["signals", "event", eventId],
    queryFn: () => fetcher({ data: { eventId } }),
    staleTime: 60_000,
  });
  // Flagged tickers (unquotable / not publicly traded) are held back for review.
  const signals = (data.signals ?? []).filter((s) => !s.needs_review);
  if (signals.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {signals.slice(0, 8).map((s) => (
        <SignalBadge
          key={s.id}
          signal={s}
          currentPrice={data.latest[s.id]?.price ?? null}
        />
      ))}
      {signals.length > 8 && (
        <span className="text-[11px] text-muted-foreground self-center">
          +{signals.length - 8} more
        </span>
      )}
    </div>
  );
}
