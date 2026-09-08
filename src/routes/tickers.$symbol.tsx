import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteShell } from "@/components/site-shell";
import { useTickerRollups } from "@/hooks/use-ticker-rollups";
import { useLiveQuotes } from "@/hooks/use-live-quotes";
import {
  combinedMovePct,
  CONFLICT_NOTE,
  STANCE_CLASS,
  STANCE_LABEL,
} from "@/lib/ticker-rollup";
import { fmtPct, fmtPrice, pctTone, STATUS_LABEL } from "@/lib/signal-metrics";
import { TickerLabel } from "@/components/ticker-meta-chips";
import { useLiveEvents } from "@/hooks/use-live-events";
import { listSignals } from "@/lib/signals.functions";
import { getQuote } from "@/lib/quotes.functions";
import { listAnalogues } from "@/lib/analogues.functions";
import { TradingViewChart } from "@/components/tradingview";
import { tickerMeta } from "@/lib/ticker-registry";
import { addTicker, removeTicker, useWatchlist } from "@/lib/watchlist-store";
import { ROLE_LABEL, formatPct, formatWindow, roleTone } from "@/lib/analogue-mapping";
import { Plus, Check } from "lucide-react";

export const Route = createFileRoute("/tickers/$symbol")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.symbol} — price, exposure and signal history` },
      {
        name: "description",
        content: `Current price, live chart, active ripple signals, past signal outcomes and historical reactions for ${params.symbol}. Educational research only.`,
      },
      {
        property: "og:title",
        content: `${params.symbol} — price, exposure and signal history`,
      },
      {
        property: "og:description",
        content: `Events driving ${params.symbol} exposure, with price and history. Educational research only.`,
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TickerDetail,
});

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={"mt-0.5 font-mono text-sm tabular-nums " + (tone ?? "text-foreground")}>
        {value}
      </div>
    </div>
  );
}

function TickerDetail() {
  const { symbol: raw } = Route.useParams();
  const symbol = raw.toUpperCase();
  const meta = tickerMeta(symbol);
  const quoteSymbol = (meta.quote || symbol).toUpperCase();

  const { rows, isLoading: rollupsLoading } = useTickerRollups();
  const row = rows.find((r) => r.ticker.toUpperCase() === symbol);
  const { quotes } = useLiveQuotes(meta.tradable ? [quoteSymbol] : []);
  const { events } = useLiveEvents();
  const eventById = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);

  const watchlist = useWatchlist();
  const inList = watchlist.includes(symbol);

  const fetchQuote = useServerFn(getQuote);
  const { data: quoteData } = useQuery({
    queryKey: ["quote", quoteSymbol],
    queryFn: () => fetchQuote({ data: { ticker: quoteSymbol } }),
    enabled: meta.tradable,
    staleTime: 60_000,
  });

  const allSignals = useServerFn(listSignals);
  const { data: signalData } = useQuery({
    queryKey: ["signals", "all"],
    queryFn: () => allSignals(),
    staleTime: 60_000,
  });

  const analogues = useServerFn(listAnalogues);
  const { data: analogueData } = useQuery({
    queryKey: ["analogues", "all"],
    queryFn: () => analogues({ data: {} }),
    staleTime: 10 * 60_000,
  });

  const live = quotes[quoteSymbol] ?? null;
  const price = live?.price ?? quoteData?.quote?.price ?? null;
  const changePct = live?.changePct ?? quoteData?.quote?.changePct ?? null;
  const currency = live?.currency ?? quoteData?.quote?.currency ?? null;
  const snap = quoteData?.quote ?? null;

  const money = (v: number | null | undefined) =>
    v == null || !isFinite(v)
      ? "—"
      : !currency || currency === "USD"
        ? `$${v.toFixed(2)}`
        : `${v.toFixed(2)} ${currency}`;

  const history = useMemo(
    () =>
      (signalData?.signals ?? [])
        .filter((s) => s.ticker.toUpperCase() === symbol && s.status !== "open")
        .slice(0, 20),
    [signalData, symbol],
  );

  const reactions = useMemo(() => {
    const evs = new Map((analogueData?.events ?? []).map((e) => [e.id, e]));
    return (analogueData?.reactions ?? [])
      .filter((r) => r.ticker.toUpperCase() === symbol)
      .map((r) => ({ r, ev: evs.get(r.historical_event_id) ?? null }));
  }, [analogueData, symbol]);

  const move = row ? combinedMovePct(row, price) : null;

  return (
    <SiteShell>
      <Link to="/tickers" className="text-xs text-primary hover:underline">
        ← All tickers
      </Link>

      <div className="mt-2 mb-1 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight font-mono">
          <TickerLabel ticker={symbol} />
        </h1>
        {row && (
          <span
            className={
              "rounded border px-2 py-0.5 text-[11px] font-mono " + STANCE_CLASS[row.stance]
            }
          >
            {STANCE_LABEL[row.stance]}
          </span>
        )}
        {move != null && (
          <span className={"font-mono tabular-nums text-sm " + pctTone(move)}>
            {fmtPct(move, 1)} since earliest snapshot
          </span>
        )}
        <button
          type="button"
          onClick={() => (inList ? removeTicker(symbol) : addTicker(symbol))}
          className="ml-auto inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-card/60 transition-colors"
        >
          {inList ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
          {inList ? "On your watchlist" : "Add to watchlist"}
        </button>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        {quoteData?.profile?.name ?? meta.name ?? "Company details unavailable"}
        {quoteData?.profile?.industry ? ` · ${quoteData.profile.industry}` : ""}
        {quoteData?.profile?.exchange ? ` · ${quoteData.profile.exchange}` : ""}
      </p>

      {/* Price */}
      <section className="rounded-xl border border-border/70 bg-card/60 p-4 mb-5">
        <div className="flex items-baseline justify-between gap-3 mb-3">
          <h2 className="text-sm font-semibold tracking-tight">Price</h2>
          <span className="text-[11px] text-muted-foreground">
            delayed
            {live?.at ? ` · ${new Date(live.at).toLocaleTimeString()}` : ""}
          </span>
        </div>
        {!meta.tradable ? (
          <p className="text-xs text-muted-foreground">
            No tradeable listing for this name (private, unlisted, or without a liquid
            US-listed equivalent), so no price is tracked. It is shown here for
            exposure context only.
          </p>
        ) : price == null ? (
          <p className="text-xs text-muted-foreground">
            No price stored for {quoteSymbol} yet — the shared price store fills in on the
            next refresh.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <Stat label="Last" value={money(price)} />
            <Stat
              label="Change today"
              value={changePct == null ? "—" : `${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%`}
              tone={pctTone(changePct)}
            />
            <Stat label="Day high" value={money(snap?.high ?? null)} />
            <Stat label="Day low" value={money(snap?.low ?? null)} />
            <Stat label="Prev close" value={money(live?.prevClose ?? snap?.prevClose ?? null)} />
          </div>
        )}
      </section>

      {/* Chart */}
      {meta.tradable && (
        <section className="mb-5">
          <h2 className="text-sm font-semibold tracking-tight mb-2">
            Live chart — TradingView
          </h2>
          <TradingViewChart symbol={quoteSymbol} />
        </section>
      )}

      {/* Active signals */}
      <section className="mb-5">
        <h2 className="text-sm font-semibold tracking-tight mb-2">Active exposure</h2>
        {row?.stance === "conflicted" && (
          <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground mb-3">
            {CONFLICT_NOTE} {row.activeLong} active long signal(s) and {row.activeShort}{" "}
            active short signal(s) point in opposite directions on this name.
          </div>
        )}
        {!row ? (
          <p className="text-xs text-muted-foreground">
            {rollupsLoading
              ? "Loading…"
              : "No active signals on this symbol right now — no current event maps exposure to it."}
          </p>
        ) : (
          <div className="rounded-xl border border-border/70 bg-card/40 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground uppercase tracking-wider text-[10px]">
                <tr className="border-b border-border/60">
                  <th className="text-left p-2">Event</th>
                  <th className="text-left p-2">Direction</th>
                  <th className="text-right p-2">Snapshot</th>
                  <th className="text-right p-2">Move</th>
                </tr>
              </thead>
              <tbody>
                {row.signals.map((s) => {
                  const ev = eventById.get(s.event_id);
                  const rawPct =
                    s.signal_price && price != null
                      ? ((price - s.signal_price) / s.signal_price) * 100
                      : null;
                  const dirPct =
                    rawPct == null ? null : s.direction === "long" ? rawPct : -rawPct;
                  return (
                    <tr key={s.id} className="border-b border-border/40 last:border-b-0">
                      <td className="p-2">
                        {ev ? (
                          <Link
                            to="/event/$id"
                            params={{ id: ev.id }}
                            className="hover:underline"
                          >
                            {ev.headline}
                          </Link>
                        ) : (
                          s.event_id
                        )}
                      </td>
                      <td className="p-2">
                        <Link
                          to="/signal/$id"
                          params={{ id: s.id }}
                          className={
                            "rounded border px-1.5 py-0.5 text-[10px] font-mono " +
                            (s.direction === "long"
                              ? "bg-tailwind/15 text-tailwind border-tailwind/30"
                              : "bg-headwind/15 text-headwind border-headwind/30")
                          }
                        >
                          {s.direction === "long" ? "LONG" : "SHORT"}
                        </Link>
                      </td>
                      <td className="p-2 text-right tabular-nums font-mono">
                        {s.signal_price == null ? "—" : s.signal_price.toFixed(2)}
                      </td>
                      <td
                        className={"p-2 text-right tabular-nums font-mono " + pctTone(dirPct)}
                      >
                        {fmtPct(dirPct, 1)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Past signals */}
      <section className="mb-5">
        <h2 className="text-sm font-semibold tracking-tight mb-2">
          Past signals on this symbol
        </h2>
        {history.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nothing resolved on this symbol yet.
          </p>
        ) : (
          <div className="rounded-xl border border-border/70 bg-card/40 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground uppercase tracking-wider text-[10px]">
                <tr className="border-b border-border/60">
                  <th className="text-left p-2">Flagged</th>
                  <th className="text-left p-2">Direction</th>
                  <th className="text-right p-2">Entry</th>
                  <th className="text-right p-2">Exit</th>
                  <th className="text-left p-2">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {history.map((s) => {
                  const rawPct =
                    s.signal_price && s.closed_price
                      ? ((s.closed_price - s.signal_price) / s.signal_price) * 100
                      : null;
                  const dirPct =
                    rawPct == null ? null : s.direction === "long" ? rawPct : -rawPct;
                  return (
                    <tr key={s.id} className="border-b border-border/40 last:border-b-0">
                      <td className="p-2">
                        <Link
                          to="/signal/$id"
                          params={{ id: s.id }}
                          className="hover:underline"
                        >
                          {new Date(s.signal_timestamp).toLocaleDateString()}
                        </Link>
                      </td>
                      <td className="p-2 font-mono text-[10px]">
                        <span
                          className={
                            s.direction === "long" ? "text-tailwind" : "text-headwind"
                          }
                        >
                          {s.direction === "long" ? "LONG" : "SHORT"}
                        </span>
                      </td>
                      <td className="p-2 text-right tabular-nums font-mono">
                        {fmtPrice(s.signal_price)}
                      </td>
                      <td className="p-2 text-right tabular-nums font-mono">
                        {fmtPrice(s.closed_price)}
                      </td>
                      <td className="p-2">
                        <span className="text-muted-foreground">
                          {STATUS_LABEL[s.status] ?? s.status}
                        </span>{" "}
                        <span className={"tabular-nums font-mono " + pctTone(dirPct)}>
                          {fmtPct(dirPct, 1)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Historical reactions */}
      <section className="mb-5">
        <h2 className="text-sm font-semibold tracking-tight mb-2">
          Historical reactions
        </h2>
        {reactions.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No recorded reaction for this symbol in the historical library.
          </p>
        ) : (
          <div className="rounded-xl border border-border/70 bg-card/40 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground uppercase tracking-wider text-[10px]">
                <tr className="border-b border-border/60">
                  <th className="text-left p-2">Past event</th>
                  <th className="text-left p-2">Role</th>
                  <th className="text-right p-2">Move</th>
                  <th className="text-right p-2">Window</th>
                  <th className="text-right p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {reactions.map(({ r, ev }) => (
                  <tr key={r.id} className="border-b border-border/40 last:border-b-0">
                    <td className="p-2">
                      {ev ? `${ev.title} · ${ev.event_date}` : "—"}
                    </td>
                    <td className="p-2">
                      <span
                        className={
                          "inline-block text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border " +
                          roleTone(r.role)
                        }
                      >
                        {ROLE_LABEL[r.role]}
                      </span>
                    </td>
                    <td
                      className={
                        "p-2 text-right tabular-nums font-mono " +
                        (r.direction === "up" ? "text-tailwind" : "text-headwind")
                      }
                    >
                      {formatPct(Number(r.pct_move))}
                    </td>
                    <td className="p-2 text-right text-muted-foreground">
                      {formatWindow(r.window_days)}
                    </td>
                    <td className="p-2 text-right text-muted-foreground">
                      {r.reverted ? "Reverted" : "Held"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-[11px] text-muted-foreground">
        Delayed prices. Educational research only — not investment advice.
      </p>
    </SiteShell>
  );
}
