import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { mirrorPaperTrade } from "@/lib/bridge.functions";

/** Opt-in per trade: sends one open order to the connected demo account. */
export function MirrorTradeButton({
  paperTradeId,
  lots,
  mirrored,
  ticket,
}: {
  paperTradeId: string;
  lots: number;
  mirrored: boolean;
  ticket: number | null;
}) {
  const queryClient = useQueryClient();
  const mirror = useServerFn(mirrorPaperTrade);
  const [error, setError] = useState<string | null>(null);

  const run = useMutation({
    mutationFn: () => mirror({ data: { paperTradeId, lots } }),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["demo-account"] });
      void queryClient.invalidateQueries({ queryKey: ["paper-trades"] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Could not mirror this trade"),
  });

  if (mirrored) {
    return (
      <span className="text-[10px] uppercase tracking-wider text-primary">
        Mirrored{ticket != null ? ` #${ticket}` : ""}
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <button
        type="button"
        disabled={run.isPending}
        onClick={() => run.mutate()}
        className="rounded-md border border-primary/40 px-2 py-0.5 text-[10px] text-primary hover:bg-primary/10 disabled:opacity-50"
      >
        {run.isPending ? "Sending…" : "Mirror to demo"}
      </button>
      {error && <span className="max-w-[16rem] text-[9px] text-headwind">{error}</span>}
    </span>
  );
}
