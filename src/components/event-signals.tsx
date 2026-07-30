import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listSignalsForEvent } from "@/lib/signals.functions";
import { useLiveQuotes } from "@/hooks/use-live-quotes";
import { tickerMeta } from "@/lib/ticker-registry";
import { SignalBadge } from "./signal-badge";

export function EventSignals({ eventId }: { eventId: string }) {
  const fetcher = useServerFn(listSignalsForEvent);
  const { data } = useSuspenseQuery({
    queryKey: ["signals", "event", eventId],
    queryFn: () => fetcher({ data: { eventId } }),
    staleTime: 60_000,
  });
  // Flagged tickers (unquotable / not publicly traded) are held back for review.
  const signals = (data.signals ?? []).filter((s) => !s.needs_review).slice(0, 8);
  // Current price comes from the live feed; the stored snapshot is only a fallback.
  const { quotes } = useLiveQuotes(
    signals.map((s) => s.quote_symbol || tickerMeta(s.ticker).quote),
  );
  if (signals.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {signals.map((s) => (
        <SignalBadge
          key={s.id}
          signal={s}
          currentPrice={
            quotes[s.quote_symbol || tickerMeta(s.ticker).quote]?.price ??
            data.latest[s.id]?.price ??
            null
          }
        />
      ))}

      {(data.signals ?? []).filter((s) => !s.needs_review).length > 8 && (
        <span className="text-[11px] text-muted-foreground self-center">
          +{(data.signals ?? []).filter((s) => !s.needs_review).length - 8} more
        </span>
      )}
    </div>
  );
}
