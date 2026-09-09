import type { InstrumentType } from "@/lib/instrument";

/**
 * Subtle outline chip marking an ETF. Stocks stay unbadged so rows stay quiet.
 */
export function EtfBadge({
  type,
  className = "",
}: {
  type: InstrumentType | null | undefined;
  className?: string;
}) {
  if (type !== "etf") return null;
  return (
    <span
      title="Exchange-traded fund"
      className={
        "ml-1 inline-block rounded border border-border/80 px-1 align-middle text-[9px] font-mono uppercase tracking-wider text-muted-foreground " +
        className
      }
    >
      ETF
    </span>
  );
}
