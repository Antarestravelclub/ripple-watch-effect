import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  manualTradePrefill,
  openManualPaperTrade,
  openPaperTrade,
  paperTradePrefill,
} from "@/lib/paper-trades.functions";
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
              <Field label="Lots (1 lot = 1 unit)" value={size} onChange={setSize} />
              <Field label="Stop price" value={stop} onChange={setStop} />
              <Field label="Target price" value={target} onChange={setTarget} />
            </div>

            <LotOutcome
              direction={prefill.direction}
              entry={Number(entry)}
              stop={Number(stop)}
              target={Number(target)}
              lots={Number(size)}
            />

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

/**
 * Shown when the risk-based size lands below the symbol's minimum lot. The size
 * is never silently rounded up: you either take the minimum knowingly, seeing
 * what it really risks, or skip the trade.
 */
function UndersizedNotice({
  sizing,
  balance,
  lotSource,
  onTakeMinLot,
  onSkip,
}: {
  sizing: SizingCheck;
  balance: number;
  lotSource: "broker_upload" | "default";
  onTakeMinLot: () => void;
  onSkip: () => void;
}) {
  if (!sizing.undersized) return null;
  return (
    <div className="mt-4 rounded-md border border-amber/50 bg-amber/10 p-3 text-xs text-amber">
      <p className="font-semibold">Undersized at this balance</p>
      <p className="mt-1 text-amber/90">
        Risk-based size is {sizing.rawSize} lots, below the minimum tradable{" "}
        {sizing.minLot} lot{sizing.minLot === 1 ? "" : "s"}
        {lotSource === "broker_upload" ? " for this symbol" : " (account default)"}. Taking the
        minimum risks {sizing.minLotRiskDollars != null ? fmtMoney(sizing.minLotRiskDollars) : "—"}
        {sizing.minLotRiskPct != null
          ? ` — ${sizing.minLotRiskPct}% of your ${fmtMoney(balance)} balance`
          : ""}
        {sizing.minLotNotional != null ? `, using ${fmtMoney(sizing.minLotNotional)} of it` : ""}.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onTakeMinLot}
          className="rounded-md border border-amber/60 bg-amber/20 px-2.5 py-1 text-[11px] font-medium text-amber hover:bg-amber/30"
        >
          Take at minimum lot ({sizing.minLot})
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="rounded-md border border-border/70 px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-accent"
        >
          Skip this trade
        </button>
      </div>
    </div>
  );
}

/**
 * What the chosen lot amount is worth in money: loss at the stop, gain at the
 * target, and the value of a 1% move. Paper measurement only.
 */
function LotOutcome({
  direction,
  entry,
  stop,
  target,
  lots,
}: {
  direction: "long" | "short";
  entry: number;
  stop: number;
  target: number;
  lots: number;
}) {
  if (!(entry > 0) || !(lots > 0)) return null;
  const sign = direction === "short" ? -1 : 1;
  const risk = stop > 0 ? (stop - entry) * sign * lots : null;
  const reward = target > 0 ? (target - entry) * sign * lots : null;
  const onePct = entry * 0.01 * lots;

  return (
    <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg border border-border/60 bg-card/50 p-2.5 text-center">
      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">If stopped</p>
        <p className="font-mono text-sm text-headwind">
          {risk != null ? fmtMoney(risk) : "—"}
        </p>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">At target</p>
        <p className="font-mono text-sm text-tailwind">
          {reward != null ? fmtMoney(reward) : "—"}
        </p>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Per 1% move</p>
        <p className="font-mono text-sm">{fmtMoney(onePct)}</p>
      </div>
    </div>
  );
}

/**
 * Free-form paper trade on any symbol, with no signal behind it. Pre-fills the
 * entry from the shared price store and the stop/target from ATR(14).
 */
export function ManualPaperTradeButton({
  symbol,
  compact,
  label = "New paper trade",
}: {
  symbol?: string;
  compact?: boolean;
  label?: string;
}) {
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
        {label}
      </button>
      {open && <ManualPaperTradeForm initialSymbol={symbol ?? ""} onClose={() => setOpen(false)} />}
    </>
  );
}

function ManualPaperTradeForm({
  initialSymbol,
  onClose,
}: {
  initialSymbol: string;
  onClose: () => void;
}) {
  const prefillFn = useServerFn(manualTradePrefill);
  const openFn = useServerFn(openManualPaperTrade);
  const qc = useQueryClient();

  const [symbol, setSymbol] = useState(initialSymbol.toUpperCase());
  const [direction, setDirection] = useState<"long" | "short">("long");
  const [entry, setEntry] = useState("");
  const [stop, setStop] = useState("");
  const [target, setTarget] = useState("");
  const [size, setSize] = useState("");
  const [notes, setNotes] = useState("");

  const prefill = useMutation({
    mutationFn: (s: string) => prefillFn({ data: { symbol: s, direction } }),
    onSuccess: (p) => {
      setSymbol(p.ticker);
      setEntry(p.entryPrice != null ? String(p.entryPrice) : "");
      setStop(p.stopPrice != null ? String(p.stopPrice) : "");
      setTarget(p.targetPrice != null ? String(p.targetPrice) : "");
      setSize(p.positionSize ? String(p.positionSize) : "");
    },
  });

  // Look up the symbol we were opened with straight away.
  useEffect(() => {
    if (initialSymbol.trim()) prefill.mutate(initialSymbol.trim().toUpperCase());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const open = useMutation({
    mutationFn: () =>
      openFn({
        data: {
          symbol,
          direction,
          entryPrice: Number(entry),
          stopPrice: Number(stop),
          targetPrice: Number(target),
          positionSize: Number(size),
          notes,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["paper-trades"] });
      onClose();
    },
  });

  const p = prefill.data;
  const notional = Number(entry) > 0 && Number(size) > 0 ? Number(entry) * Number(size) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
      <div className="w-full max-w-md rounded-xl border border-border/70 bg-card p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">New paper trade</h2>
            <p className="text-xs text-muted-foreground">
              Any symbol, no event signal needed. Paper only — no broker, no order routing.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[8rem]">
            <label className="text-xs text-muted-foreground" htmlFor="mt-symbol">
              Symbol
            </label>
            <input
              id="mt-symbol"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="NVDA"
              className="mt-1 w-full rounded-md border border-border/70 bg-background px-2 py-1.5 text-sm font-mono uppercase"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground" htmlFor="mt-dir">
              Direction
            </label>
            <select
              id="mt-dir"
              value={direction}
              onChange={(e) => setDirection(e.target.value as "long" | "short")}
              className="mt-1 rounded-md border border-border/70 bg-background px-2 py-1.5 text-sm"
            >
              <option value="long">Long</option>
              <option value="short">Short</option>
            </select>
          </div>
          <button
            type="button"
            disabled={!symbol.trim() || prefill.isPending}
            onClick={() => prefill.mutate(symbol.trim())}
            className="inline-flex items-center gap-1.5 rounded-md border border-border/70 px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent disabled:opacity-60"
          >
            {prefill.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
            Look up price
          </button>
        </div>

        {prefill.error && (
          <p className="mt-3 text-xs text-headwind">
            {prefill.error instanceof Error ? prefill.error.message : "Could not price that symbol"}
          </p>
        )}
        {p?.quoteStale && (
          <p className="mt-3 rounded-md border border-amber/40 bg-amber/10 p-2 text-xs text-amber">
            Price feed looks stale
            {p.quoteTime ? ` — last quote ${fmtDuration(p.quoteTime)} ago.` : "."} Check the entry
            price before opening.
          </p>
        )}
        {p && p.atr == null && (
          <p className="mt-3 rounded-md border border-amber/40 bg-amber/10 p-2 text-xs text-amber">
            Not enough daily price history to suggest a stop, target or size — enter your own.
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Field label="Entry price" value={entry} onChange={setEntry} />
          <Field label="Lots (1 lot = 1 unit)" value={size} onChange={setSize} />
          <Field label="Stop price" value={stop} onChange={setStop} />
          <Field label="Target price" value={target} onChange={setTarget} />
        </div>

        <LotOutcome
          direction={direction}
          entry={Number(entry)}
          stop={Number(stop)}
          target={Number(target)}
          lots={Number(size)}
        />


        <p className="mt-3 text-[11px] text-muted-foreground">
          Suggestions use the same rules as signals: stop 1.5× ATR(14), target 2.0× ATR(14), size
          risking 0.5% of the {p ? fmtMoney(p.notional) : "$100,000"} paper notional. Notional at
          these values: {notional != null ? fmtMoney(notional) : "—"}.
        </p>

        <div className="mt-3">
          <label className="text-xs text-muted-foreground" htmlFor="mt-notes">
            Notes (optional)
          </label>
          <textarea
            id="mt-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-md border border-border/70 bg-background px-2 py-1.5 text-sm"
          />
        </div>

        {open.error && (
          <p className="mt-3 text-xs text-headwind">
            {open.error instanceof Error ? open.error.message : "Could not open the trade"}
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
            disabled={open.isPending || !symbol.trim()}
            onClick={() => open.mutate()}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-60"
          >
            {open.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
            Open paper trade
          </button>
        </div>
        <p className="mt-3 text-[10px] uppercase tracking-wider text-muted-foreground">
          Paper only · no broker, no order routing
        </p>
      </div>
    </div>
  );
}
