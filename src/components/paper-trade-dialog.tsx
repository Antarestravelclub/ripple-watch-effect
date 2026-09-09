import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { openPaperTrade, paperTradePrefill } from "@/lib/paper-trades.functions";
import { useAuth } from "@/hooks/use-auth";
import { fmtDuration, fmtMoney } from "@/lib/paper-trades";
import { Loader2, NotebookPen, X } from "lucide-react";

interface Props {
  signalId: string;
  ticker: string;
  compact?: boolean;
}

/**
 * "Paper Trade" affordance. Pre-fills from the signal's own ATR stop/target and
 * risk-based sizing; every field is editable and any edit is recorded as an
 * override so stats can compare as-signalled vs overridden trades.
 */
export function PaperTradeButton({ signalId, ticker, compact }: Props) {
  const { signedIn } = useAuth();
  const [open, setOpen] = useState(false);

  if (!signedIn) {
    return (
      <Link
        to="/auth"
        className={
          "inline-flex items-center gap-1 rounded-md border border-border/70 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors " +
          (compact ? "px-2 py-0.5 text-[10px]" : "px-3 py-1.5 text-xs")
        }
      >
        <NotebookPen className="w-3 h-3" />
        Sign in to paper trade
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          "inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 transition-colors " +
          (compact ? "px-2 py-0.5 text-[10px]" : "px-3 py-1.5 text-xs")
        }
      >
        <NotebookPen className="w-3 h-3" />
        Paper trade
      </button>
      {open && (
        <PaperTradeForm signalId={signalId} ticker={ticker} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

function PaperTradeForm({
  signalId,
  ticker,
  onClose,
}: {
  signalId: string;
  ticker: string;
  onClose: () => void;
}) {
  const prefillFn = useServerFn(paperTradePrefill);
  const openFn = useServerFn(openPaperTrade);
  const qc = useQueryClient();

  const { data: prefill, isLoading, error } = useQuery({
    queryKey: ["paper-prefill", signalId],
    queryFn: () => prefillFn({ data: { signalId } }),
  });

  const [entry, setEntry] = useState("");
  const [stop, setStop] = useState("");
  const [target, setTarget] = useState("");
  const [size, setSize] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!prefill) return;
    setEntry(prefill.entryPrice != null ? String(prefill.entryPrice) : "");
    setStop(prefill.stopPrice != null ? String(prefill.stopPrice) : "");
    setTarget(prefill.targetPrice != null ? String(prefill.targetPrice) : "");
    setSize(prefill.positionSize ? String(prefill.positionSize) : "");
  }, [prefill]);

  const mut = useMutation({
    mutationFn: () => {
      const overridesUsed =
        prefill != null &&
        (Number(entry) !== prefill.entryPrice ||
          Number(stop) !== prefill.stopPrice ||
          Number(target) !== prefill.targetPrice ||
          Number(size) !== prefill.positionSize);
      return openFn({
        data: {
          signalId,
          entryPrice: Number(entry),
          stopPrice: Number(stop),
          targetPrice: Number(target),
          positionSize: Number(size),
          overridesUsed,
          notes,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["paper-trades"] });
      qc.invalidateQueries({ queryKey: ["paper-prefill", signalId] });
      onClose();
    },
  });

  const notional =
    prefill && Number(entry) > 0 && Number(size) > 0 ? Number(entry) * Number(size) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
      <div className="w-full max-w-md rounded-xl border border-border/70 bg-card p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold font-mono">{ticker}</h2>
            <p className="text-xs text-muted-foreground">
              Paper trade · {prefill?.direction === "short" ? "Short" : "Long"} (fixed by the
              signal)
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {isLoading && (
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading signal levels…
          </p>
        )}
        {error && (
          <p className="mt-4 text-sm text-headwind">
            {error instanceof Error ? error.message : "Could not load the signal"}
          </p>
        )}

        {prefill && (
          <>
            {prefill.hasOpenTrade && (
              <p className="mt-4 rounded-md border border-amber/40 bg-amber/10 p-2 text-xs text-amber">
                You already have an open paper trade on this signal. Close it before opening
                another.
              </p>
            )}
            {prefill.quoteStale && (
              <p className="mt-4 rounded-md border border-amber/40 bg-amber/10 p-2 text-xs text-amber">
                Price feed looks stale
                {prefill.quoteTime
                  ? ` — last quote ${fmtDuration(prefill.quoteTime)} ago.`
                  : " — no stored quote for this symbol."}{" "}
                Check the entry price before opening.
              </p>
            )}

            <div className="mt-4 grid grid-cols-2 gap-3">
              <Field label="Entry price" value={entry} onChange={setEntry} />
              <Field label="Position size (units)" value={size} onChange={setSize} />
              <Field label="Stop price" value={stop} onChange={setStop} />
              <Field label="Target price" value={target} onChange={setTarget} />
            </div>

            <p className="mt-3 text-[11px] text-muted-foreground">
              Pre-filled from the signal's ATR stop/target and risk-based sizing
              {prefill.suggestedSizePct
                ? ` (${prefill.suggestedSizePct}% of ${fmtMoney(prefill.notional)} paper notional)`
                : ""}
              . Notional at these values: {notional != null ? fmtMoney(notional) : "—"}.
            </p>

            <div className="mt-3">
              <label className="text-xs text-muted-foreground" htmlFor="pt-notes">
                Notes (optional)
              </label>
              <textarea
                id="pt-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-md border border-border/70 bg-background px-2 py-1.5 text-sm"
              />
            </div>

            {mut.error && (
              <p className="mt-3 text-xs text-headwind">
                {mut.error instanceof Error ? mut.error.message : "Could not open the trade"}
              </p>
            )}

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-border/70 px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={mut.isPending || prefill.hasOpenTrade}
                onClick={() => mut.mutate()}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-60"
              >
                {mut.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                Open paper trade
              </button>
            </div>
            <p className="mt-3 text-[10px] uppercase tracking-wider text-muted-foreground">
              Paper only · no broker, no order routing
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <input
        type="number"
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-border/70 bg-background px-2 py-1.5 text-sm font-mono"
      />
    </div>
  );
}
