// Scorecard add-ons:
//  - AddSymbolSection: type any symbol and track it as your own signal
//    (same ATR stop/target + conviction pipeline as engine signals).
//  - HighConvictionCheck: does an 80+ conviction score actually hit target?
//  - RateClosedPositions: give each closed paper trade a 1-5 rating + note.
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Star } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { ManualSignalButton } from "@/components/manual-signal-dialog";
import { TickerLink } from "@/components/ticker-link";
import { listPaperTrades, ratePaperTrade } from "@/lib/paper-trades.functions";
import {
  EXIT_REASON_LABEL,
  fmtMoney,
  fmtR,
  rMultipleFor,
  type PaperTradeRow,
} from "@/lib/paper-trades";
import type { SignalRow } from "@/lib/signal-metrics";

const STOP_REASONS = ["invalidation", "stop", "close_beyond", "event_reversed"];
const EXPIRE_REASONS = ["expired", "max_days_open"];

/* ------------------------------------------------------------------ */
/* Add a symbol manually                                               */
/* ------------------------------------------------------------------ */

export function AddSymbolSection() {
  const [symbol, setSymbol] = useState("");
  const clean = symbol.trim().toUpperCase();

  return (
    <section className="rounded-xl border border-border/70 bg-card/40 p-4 mb-6">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-primary">
        Add a symbol
      </h2>
      <p className="text-[11px] text-muted-foreground mt-1 mb-3">
        Track any stock or ETF yourself. It gets the same ATR stop and target and conviction
        score as engine signals, then shows up here under “My signals” once it resolves.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          placeholder="e.g. XOM"
          maxLength={15}
          className="w-32 rounded-md border border-border/70 bg-background px-2 py-1.5 text-xs font-mono uppercase"
        />
        {/* key forces the dialog to pick up the typed symbol */}
        <ManualSignalButton key={clean} symbol={clean} label={clean ? `Add ${clean}` : "Add symbol"} />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 80+ conviction check                                                */
/* ------------------------------------------------------------------ */

export function HighConvictionCheck({ signals }: { signals: SignalRow[] }) {
  const stats = useMemo(() => {
    // ATR-era signals only: legacy percentage targets aren't comparable.
    const atr = signals.filter((s) => s.atr_at_signal != null && s.stop_price != null);
    const tally = (rows: SignalRow[]) => {
      const t = rows.filter((s) => s.close_reason === "target").length;
      const st = rows.filter((s) => STOP_REASONS.includes(s.close_reason ?? "")).length;
      const ex = rows.filter((s) => EXPIRE_REASONS.includes(s.close_reason ?? "")).length;
      const n = t + st + ex;
      return { t, st, ex, n, open: rows.length - n, rate: n > 0 ? (t / n) * 100 : null };
    };
    return {
      high: tally(atr.filter((s) => (s.conviction_score ?? -1) >= 80 && !s.below_threshold)),
      rest: tally(atr.filter((s) => (s.conviction_score ?? -1) < 80 || s.below_threshold)),
    };
  }, [signals]);

  const { high, rest } = stats;
  const small = high.n < 30;

  return (
    <section className="rounded-xl border border-border/70 bg-card/40 p-4 mb-6">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-primary">
        Do 80+ conviction signals hit their ATR target?
      </h2>
      <p className="text-[11px] text-muted-foreground mt-1 mb-3">
        Resolved ATR-era signals only. With a 1.5× ATR stop the target sits further away than
        the stop, so a hit rate under 50% can still be profitable — compare against the rest.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <BandTile label="Conviction 80+" s={high} />
        <BandTile label="Below 80" s={rest} />
      </div>
      {small && (
        <p className="mt-3 text-[11px] text-amber-400">
          Only {high.n} resolved 80+ signal{high.n === 1 ? "" : "s"} so far — too few to trust
          the percentage. Treat it as a trend to watch until there are at least 30.
        </p>
      )}
    </section>
  );
}

function BandTile({
  label,
  s,
}: {
  label: string;
  s: { t: number; st: number; ex: number; n: number; open: number; rate: number | null };
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-mono tabular-nums">
        {s.rate == null ? "—" : `${s.rate.toFixed(0)}%`}
      </div>
      <div className="text-[11px] text-muted-foreground mt-0.5">
        {s.t} target / {s.st} stopped / {s.ex} expired · {s.open} open
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Rate closed positions                                               */
/* ------------------------------------------------------------------ */

export function RateClosedPositions() {
  const { signedIn, loading } = useAuth();
  const list = useServerFn(listPaperTrades);
  const [show, setShow] = useState<"unrated" | "all">("unrated");

  const { data, isLoading, error } = useQuery({
    queryKey: ["paper-trades"],
    queryFn: () => list(),
    enabled: signedIn,
    staleTime: 30_000,
  });

  const closed = useMemo(
    () =>
      (data?.trades ?? [])
        .filter((t) => t.status === "closed")
        .sort((a, b) => (b.exit_time ?? "").localeCompare(a.exit_time ?? "")),
    [data],
  );
  const rated = closed.filter((t) => t.rating != null);
  const rows = show === "unrated" ? closed.filter((t) => t.rating == null) : closed;
  const avg =
    rated.length > 0 ? rated.reduce((a, t) => a + (t.rating ?? 0), 0) / rated.length : null;

  // Do the trades you rate highly actually make money?
  const byRating = [5, 4, 3, 2, 1].map((r) => {
    const ts = rated.filter((t) => t.rating === r);
    const pnl = ts.reduce((a, t) => a + Number(t.realized_pnl ?? 0), 0);
    return { r, n: ts.length, pnl };
  });

  return (
    <section className="rounded-xl border border-border/70 bg-card/40 p-4 mt-6">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-primary">
          Rate closed positions
        </h2>
        {signedIn && closed.length > 0 && (
          <div className="flex items-center gap-1 text-[11px]">
            {(["unrated", "all"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setShow(k)}
                className={`rounded-md border px-2 py-0.5 ${
                  show === k
                    ? "border-primary text-primary bg-primary/10"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {k === "unrated" ? `Unrated (${closed.length - rated.length})` : `All (${closed.length})`}
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground mt-1 mb-3">
        Grade how well each closed Trade Log position was taken — entry, patience, exit — not just
        whether it made money. Over time this shows whether your best-rated trades are your most
        profitable ones.
      </p>

      {!loading && !signedIn && (
        <p className="text-xs text-muted-foreground">
          <Link to="/auth" className="text-primary hover:underline">
            Sign in
          </Link>{" "}
          to rate your closed positions.
        </p>
      )}
      {signedIn && isLoading && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading closed positions…
        </p>
      )}
      {error && (
        <p className="text-xs text-headwind">
          {error instanceof Error ? error.message : "Could not load your trades"}
        </p>
      )}

      {signedIn && !isLoading && closed.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No closed positions yet. Trades from the{" "}
          <Link to="/blotter" className="text-primary hover:underline">
            Trade Log
          </Link>{" "}
          appear here once they close.
        </p>
      )}

      {rated.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2 text-[11px]">
          <span className="rounded-md border border-border/60 px-2 py-1">
            Avg rating <span className="font-mono">{avg!.toFixed(1)}★</span> · {rated.length} rated
          </span>
          {byRating
            .filter((b) => b.n > 0)
            .map((b) => (
              <span key={b.r} className="rounded-md border border-border/60 px-2 py-1">
                {b.r}★ × {b.n}:{" "}
                <span className={b.pnl >= 0 ? "text-tailwind" : "text-headwind"}>
                  {fmtMoney(b.pnl)}
                </span>
              </span>
            ))}
        </div>
      )}

      {signedIn && closed.length > 0 && rows.length === 0 && (
        <p className="text-xs text-muted-foreground">Every closed position is rated. 👍</p>
      )}

      <div className="space-y-2">
        {rows.map((t) => (
          <RateRow key={t.id} trade={t} />
        ))}
      </div>
    </section>
  );
}

function RateRow({ trade: t }: { trade: PaperTradeRow }) {
  const rateFn = useServerFn(ratePaperTrade);
  const qc = useQueryClient();
  const [rating, setRating] = useState<number | null>(t.rating);
  const [hover, setHover] = useState<number | null>(null);
  const [note, setNote] = useState(t.rating_note ?? "");

  const save = useMutation({
    mutationFn: (v: { rating: number | null; note: string }) =>
      rateFn({ data: { id: t.id, rating: v.rating, note: v.note } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["paper-trades"] }),
  });

  const r =
    t.exit_price != null ? rMultipleFor(t.direction, t.entry_price, t.stop_price, t.exit_price) : null;
  const pnl = t.realized_pnl;
  const dirty = rating !== t.rating || (note.trim() || "") !== (t.rating_note ?? "");

  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <TickerLink symbol={t.ticker}>
          <span className="font-mono font-semibold">{t.ticker}</span>
        </TickerLink>
        <span className={t.direction === "long" ? "text-tailwind" : "text-headwind"}>
          {t.direction === "long" ? "Long" : "Short"}
        </span>
        <span className="text-muted-foreground">
          {t.exit_reason ? EXIT_REASON_LABEL[t.exit_reason] : "Closed"}
          {t.exit_time ? ` · ${new Date(t.exit_time).toLocaleDateString()}` : ""}
        </span>
        <span className={"font-mono tabular-nums " + ((pnl ?? 0) >= 0 ? "text-tailwind" : "text-headwind")}>
          {fmtMoney(pnl)}
        </span>
        <span className="font-mono tabular-nums text-muted-foreground">{fmtR(r)}</span>

        <div className="ml-auto flex items-center" onMouseLeave={() => setHover(null)}>
          {[1, 2, 3, 4, 5].map((n) => {
            const on = (hover ?? rating ?? 0) >= n;
            return (
              <button
                key={n}
                type="button"
                aria-label={`${n} star${n === 1 ? "" : "s"}`}
                onMouseEnter={() => setHover(n)}
                onClick={() => setRating(rating === n ? null : n)}
                className="p-0.5"
              >
                <Star
                  className={"w-4 h-4 " + (on ? "fill-amber-400 text-amber-400" : "text-muted-foreground/50")}
                />
              </button>
            );
          })}
        </div>
      </div>

      {(rating != null || t.rating != null) && (
        <div className="mt-2 flex items-center gap-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            placeholder="Optional note — what went right or wrong?"
            className="flex-1 rounded-md border border-border/70 bg-background px-2 py-1 text-xs"
          />
          <button
            type="button"
            disabled={!dirty || save.isPending}
            onClick={() => save.mutate({ rating, note })}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground disabled:opacity-50"
          >
            {save.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
            {rating == null ? "Clear" : "Save"}
          </button>
        </div>
      )}
      {save.error && (
        <p className="mt-1 text-[11px] text-headwind">
          {save.error instanceof Error ? save.error.message : "Could not save the rating"}
        </p>
      )}
    </div>
  );
}
