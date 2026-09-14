import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { createManualSignal, manualSignalPrefill } from "@/lib/manual-signals.functions";
import { useAuth } from "@/hooks/use-auth";
import { fmtDuration, fmtMoney } from "@/lib/paper-trades";
import { Lightbulb, Loader2, X } from "lucide-react";

type Level = "Low" | "Medium" | "High";
const THEMES = [
  "Geopolitical",
  "Central Bank",
  "Commodity",
  "Regulation",
  "Tech",
  "Weather/Disaster",
] as const;

/**
 * "Add my signal" affordance. Opens a form for your own trade idea; the app
 * scores it with the same conviction rubric and ATR stop/target as engine
 * signals and tracks it in the Signal Tracker.
 */
export function ManualSignalButton({
  symbol,
  compact,
  label = "Add my signal",
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
        <Lightbulb className="w-3 h-3" />
        Sign in to add a signal
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
        <Lightbulb className="w-3 h-3" />
        {label}
      </button>
      {open && (
        <ManualSignalForm initialSymbol={symbol ?? ""} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

function ManualSignalForm({
  initialSymbol,
  onClose,
}: {
  initialSymbol: string;
  onClose: () => void;
}) {
  const prefillFn = useServerFn(manualSignalPrefill);
  const createFn = useServerFn(createManualSignal);
  const qc = useQueryClient();

  const [symbol, setSymbol] = useState(initialSymbol.toUpperCase());
  const [direction, setDirection] = useState<"long" | "short">("long");
  const [theme, setTheme] = useState<(typeof THEMES)[number]>("Geopolitical");
  const [strength, setStrength] = useState<Level>("Medium");
  const [confidence, setConfidence] = useState<Level>("Medium");
  const [thesis, setThesis] = useState("");

  const prefill = useMutation({
    mutationFn: (s: string) => prefillFn({ data: { symbol: s, direction } }),
    onSuccess: (p) => setSymbol(p.symbol),
  });

  const create = useMutation({
    mutationFn: () =>
      createFn({ data: { symbol, direction, thesis, strength, confidence, theme } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["signals"] });
    },
  });

  const p = prefill.data;
  const result = create.data;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
      <div className="w-full max-w-md rounded-xl border border-border/70 bg-card p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Add my signal</h2>
            <p className="text-xs text-muted-foreground">
              Your own idea, scored and tracked exactly like an engine signal. Paper only.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {result ? (
          <div className="mt-4">
            <p className="rounded-md border border-tailwind/40 bg-tailwind/10 p-3 text-sm text-tailwind">
              Signal created — conviction score {result.score}
              {result.belowThreshold ? " (below the engine's threshold, still tracked)" : ""}.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-lg border border-border/60 bg-card/50 p-2.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Stop</p>
                <p className="font-mono text-sm text-headwind">{fmtMoney(result.stop)}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-card/50 p-2.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Target</p>
                <p className="font-mono text-sm text-tailwind">{fmtMoney(result.target)}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <Link
                to="/signal/$id"
                params={{ id: result.id }}
                className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground"
              >
                Open the signal
              </Link>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-border/70 px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[8rem]">
                <label className="text-xs text-muted-foreground" htmlFor="ms-symbol">
                  Symbol
                </label>
                <input
                  id="ms-symbol"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  placeholder="e.g. NVDA"
                  className="mt-1 w-full rounded-md border border-border/70 bg-background px-2 py-1.5 text-sm font-mono"
                />
              </div>
              <div className="flex rounded-md border border-border/70 overflow-hidden">
                {(["long", "short"] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      setDirection(d);
                      prefill.reset();
                    }}
                    className={
                      "px-3 py-1.5 text-xs " +
                      (direction === d
                        ? d === "long"
                          ? "bg-tailwind/20 text-tailwind"
                          : "bg-headwind/20 text-headwind"
                        : "text-muted-foreground hover:bg-accent")
                    }
                  >
                    {d === "long" ? "Long" : "Short"}
                  </button>
                ))}
              </div>
              <button
                type="button"
                disabled={!symbol.trim() || prefill.isPending}
                onClick={() => prefill.mutate(symbol)}
                className="inline-flex items-center gap-1.5 rounded-md border border-border/70 px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent disabled:opacity-50"
              >
                {prefill.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                Check levels
              </button>
            </div>

            {prefill.error && (
              <p className="mt-3 text-xs text-headwind">
                {prefill.error instanceof Error ? prefill.error.message : "Lookup failed"}
              </p>
            )}

            {p && (
              <div className="mt-3 rounded-lg border border-border/60 bg-card/50 p-3 text-xs">
                {p.quoteStale && (
                  <p className="mb-2 rounded border border-amber/40 bg-amber/10 p-2 text-amber">
                    Price feed looks stale
                    {p.quoteTime ? ` — last quote ${fmtDuration(p.quoteTime)} ago.` : "."}
                  </p>
                )}
                {!p.enoughHistory ? (
                  <p className="text-headwind">
                    Not enough daily price history for {p.symbol} to set a volatility-based
                    stop and target — a signal can't be created on it yet.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Entry
                      </p>
                      <p className="font-mono text-sm">{fmtMoney(p.entryPrice)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Stop (1.5× ATR)
                      </p>
                      <p className="font-mono text-sm text-headwind">{fmtMoney(p.stopPrice)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Target (2× ATR)
                      </p>
                      <p className="font-mono text-sm text-tailwind">{fmtMoney(p.targetPrice)}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground" htmlFor="ms-theme">
                  Theme
                </label>
                <select
                  id="ms-theme"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value as typeof theme)}
                  className="mt-1 w-full rounded-md border border-border/70 bg-background px-2 py-1.5 text-xs"
                >
                  {THEMES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground" htmlFor="ms-strength">
                  Strength
                </label>
                <select
                  id="ms-strength"
                  value={strength}
                  onChange={(e) => setStrength(e.target.value as Level)}
                  className="mt-1 w-full rounded-md border border-border/70 bg-background px-2 py-1.5 text-xs"
                >
                  {(["Low", "Medium", "High"] as const).map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground" htmlFor="ms-confidence">
                  Confidence
                </label>
                <select
                  id="ms-confidence"
                  value={confidence}
                  onChange={(e) => setConfidence(e.target.value as Level)}
                  className="mt-1 w-full rounded-md border border-border/70 bg-background px-2 py-1.5 text-xs"
                >
                  {(["Low", "Medium", "High"] as const).map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-3">
              <label className="text-xs text-muted-foreground" htmlFor="ms-thesis">
                Your thesis
              </label>
              <textarea
                id="ms-thesis"
                value={thesis}
                onChange={(e) => setThesis(e.target.value)}
                rows={3}
                placeholder="Why should this symbol move, and what would prove you wrong?"
                className="mt-1 w-full rounded-md border border-border/70 bg-background px-2 py-1.5 text-sm"
              />
            </div>

            {create.error && (
              <p className="mt-3 text-xs text-headwind">
                {create.error instanceof Error ? create.error.message : "Could not create the signal"}
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
                disabled={
                  create.isPending || thesis.trim().length < 10 || !symbol.trim()
                }
                onClick={() => create.mutate()}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-60"
              >
                {create.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                Create signal
              </button>
            </div>
            <p className="mt-3 text-[10px] uppercase tracking-wider text-muted-foreground">
              Paper only · scored by the same rubric as engine signals · no advice
            </p>
          </>
        )}
      </div>
    </div>
  );
}
