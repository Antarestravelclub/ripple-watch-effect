import { useLastDataRefresh } from "@/lib/data-refresh-store";

/** Header stamp telling the user how current the feed and prices are. */
export function DataRefreshStamp({ className = "" }: { className?: string }) {
  const at = useLastDataRefresh();
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 text-[10px] text-muted-foreground whitespace-nowrap " +
        className
      }
      title="Last time live quote data was received. Prices are delayed."
    >
      <span
        className={
          "w-1.5 h-1.5 rounded-full " + (at ? "bg-tailwind animate-pulse" : "bg-muted")
        }
      />
      {at
        ? `Data refreshed ${new Date(at).toLocaleTimeString()}`
        : "Waiting for data…"}
    </span>
  );
}
