import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { SiteShell } from "@/components/site-shell";
import { TickerLink } from "@/components/ticker-link";
import { ManualPaperTradeButton } from "@/components/paper-trade-dialog";
import { DemoAccountPanel } from "@/components/demo-account-panel";
import { StartingBalanceCard } from "@/components/starting-balance-card";
import { DEFAULT_STARTING_BALANCE } from "@/lib/paper-account";
import { MirrorTradeButton } from "@/components/mirror-trade-button";
import { averageSlippage, mirrorComparisons } from "@/lib/paper-trades";
import { closePaperTrade, listPaperTrades } from "@/lib/paper-trades.functions";
import {
  computeStats,
  equityCurve,
  EXIT_REASON_LABEL,
  fmtDuration,
  fmtMoney,
  fmtR,
  liveMetrics,
  SMALL_SAMPLE,
  SOURCE_LABEL,
  SPLIT_LABEL,
  splitStats,
  type ExitReason,
  type PaperTradeRow,
  type SplitKey,
  type TradeSource,
} from "@/lib/paper-trades";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";


export const Route = createFileRoute("/_authenticated/blotter")({
  head: () => ({
    meta: [
      { title: "Paper Trade Blotter — The Ripple Effect" },
      {
        name: "description",
        content:
          "Track paper trades taken from event-driven signals: live P&L, distance to stop and target, realised results and honest statistics.",
      },
      { property: "og:title", content: "Paper Trade Blotter — The Ripple Effect" },
      {
        property: "og:description",
        content: "Measure signals as traded, not just as issued. Paper only, no live execution.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BlotterPage,
});

type Tab = "open" | "closed" | "stats";

function pctTone(n: number | null | undefined) {
  if (n == null) return "text-muted-foreground";
  return n > 0 ? "text-tailwind" : n < 0 ? "text-headwind" : "text-muted-foreground";
}

function fmtPct(n: number | null | undefined) {
  return n == null ? "—" : `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function BlotterPage() {
  const list = useServerFn(listPaperTrades);
  const closeFn = useServerFn(closePaperTrade);
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("open");
  const [confirm, setConfirm] = useState<{ trade: PaperTradeRow; price: number | null } | null>(
    null,
  );

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["paper-trades"],
    queryFn: () => list(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const closeMut = useMutation({
    mutationFn: (id: string) => closeFn({ data: { id } }),
    onSuccess: () => {
      setConfirm(null);
      qc.invalidateQueries({ queryKey: ["paper-trades"] });
    },
  });

  const trades = data?.trades ?? [];
  const openTrades = trades.filter((t) => t.status === "open");
  const closedTrades = trades.filter((t) => t.status === "closed");
  const priceOf = (t: PaperTradeRow) =>
    data?.prices[(t.quote_symbol || t.ticker).toUpperCase()]?.price ?? null;

  const [filters, setFilters] = useState<ClosedFilters>({
    reason: "all",
    source: "all",
    from: "",
    to: "",
  });
  const isFiltered =
    filters.reason !== "all" || filters.source !== "all" || filters.from !== "" || filters.to !== "";
  const filteredClosed = useMemo(
    () => applyClosedFilters(closedTrades, filters),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trades, filters],
  );

  return (
    <SiteShell>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Paper Trade Blotter</h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
            Act on signals the way a trader would and measure the result. This is a measurement
            layer only: paper trades never touch live execution, and the Scorecard keeps measuring
            signals as issued while the Blotter measures them as traded.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ManualPaperTradeButton />
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 rounded-md border border-border/70 px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent"
          >
            <RefreshCw className={"w-3.5 h-3.5 " + (isFetching ? "animate-spin" : "")} />
            Refresh
          </button>
        </div>

      </div>

      {data?.feedStale && (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-amber/40 bg-amber/10 p-3 text-xs text-amber">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            Price feed looks stale
            {data.lastQuoteTime ? ` — last quote ${fmtDuration(data.lastQuoteTime)} ago.` : "."}{" "}
            Unrealised numbers below may be behind, and automatic exits are skipped until fresh
            prices arrive.
          </span>
        </div>
      )}

      <div className="mt-5">
        <StartingBalanceCard />
      </div>

      <div className="mt-5">
        <DemoAccountPanel />
      </div>

      <div className="mt-5 flex items-center gap-1 border-b border-border/60">
        {(
          [
            ["open", `Open (${openTrades.length})`],
            ["closed", `Closed (${closedTrades.length})`],
            ["stats", "Stats"],
          ] as Array<[Tab, string]>
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={
              "px-3 py-2 text-sm -mb-px border-b-2 transition-colors " +
              (tab === key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground")
            }
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading && (
        <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading your blotter…
        </p>
      )}
      {error && (
        <p className="mt-6 text-sm text-headwind">
          {error instanceof Error ? error.message : "Could not load your paper trades"}
        </p>
      )}

      {!isLoading && tab === "open" && (
        <OpenTable
          trades={openTrades}
          priceOf={priceOf}
          onClose={(t) => setConfirm({ trade: t, price: priceOf(t) })}
        />
      )}
      {!isLoading && tab === "closed" && (
        <ClosedTable rows={filteredClosed} filters={filters} setFilters={setFilters} />
      )}
      {!isLoading && tab === "stats" && (
        <>
          <StatsView trades={closedTrades} notional={data?.notional ?? DEFAULT_STARTING_BALANCE} />
          <MirrorStats trades={data?.trades ?? []} />
        </>
      )}

      {!isLoading && (
        <AccumulatedResults
          closed={filteredClosed}
          open={openTrades}
          priceOf={priceOf}
          notional={data?.notional ?? DEFAULT_STARTING_BALANCE}
          filtered={isFiltered}
          feedStale={Boolean(data?.feedStale)}
          lastQuoteTime={data?.lastQuoteTime ?? null}
        />
      )}

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
          <div className="w-full max-w-sm rounded-xl border border-border/70 bg-card p-5">
            <h2 className="text-base font-semibold">
              Close {confirm.trade.ticker} paper trade?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Fill price would be{" "}
              <span className="font-mono text-foreground">
                {confirm.price != null ? confirm.price.toFixed(2) : "unavailable"}
              </span>{" "}
              — the latest stored quote. Exit reason will be recorded as closed manually.
            </p>
            {confirm.price == null && (
              <p className="mt-2 text-xs text-amber">
                No stored price for this symbol yet, so the trade cannot be closed right now.
              </p>
            )}
            {closeMut.error && (
              <p className="mt-2 text-xs text-headwind">
                {closeMut.error instanceof Error ? closeMut.error.message : "Close failed"}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirm(null)}
                className="rounded-md border border-border/70 px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={closeMut.isPending || confirm.price == null}
                onClick={() => closeMut.mutate(confirm.trade.id)}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-60"
              >
                {closeMut.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                Close at {confirm.price != null ? confirm.price.toFixed(2) : "—"}
              </button>
            </div>
          </div>
        </div>
      )}
    </SiteShell>
  );
}

function OpenTable({
  trades,
  priceOf,
  onClose,
}: {
  trades: PaperTradeRow[];
  priceOf: (t: PaperTradeRow) => number | null;
  onClose: (t: PaperTradeRow) => void;
}) {
  if (trades.length === 0) {
    return (
      <div className="mt-6 space-y-3">
        <p className="text-sm text-muted-foreground">
          No open paper trades. Use <span className="text-foreground">New paper trade</span> above
          for any symbol, or open one from a signal on the{" "}
          <Link to="/tracker" className="text-primary hover:underline">
            Tracker
          </Link>{" "}
          or any signal page.
        </p>
        <ManualPaperTradeButton />
      </div>
    );
  }

  return (
    <div className="mt-5 overflow-x-auto rounded-xl border border-border/70">
      <table className="w-full text-sm">
        <thead className="bg-card/60 text-[10px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <Th>Symbol</Th>
            <Th>Dir</Th>
            <Th>Entry</Th>
            <Th>Lots</Th>
            <Th>Current</Th>
            <Th>Unrealised</Th>
            <Th>To stop</Th>
            <Th>To target</Th>
            <Th>In trade</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {trades.map((t) => {
            const m = liveMetrics(t, priceOf(t));
            return (
              <tr key={t.id} className="border-t border-border/50">
                <Td>
                  <TickerLink symbol={t.ticker} />
                  {t.overrides_used && (
                    <span className="ml-1 text-[9px] uppercase text-muted-foreground">ovr</span>
                  )}
                </Td>
                <Td>
                  <span className={t.direction === "long" ? "text-tailwind" : "text-headwind"}>
                    {t.direction}
                  </span>
                </Td>
                <Td mono>{t.entry_price.toFixed(2)}</Td>
                <Td mono>{t.position_size}</Td>
                <Td mono>{m.price != null ? m.price.toFixed(2) : "—"}</Td>
                <Td>
                  <span className={pctTone(m.pnl)}>
                    {fmtMoney(m.pnl)} · {fmtPct(m.pct)} · {fmtR(m.r)}
                  </span>
                  <span className="block text-[10px] text-muted-foreground">
                    {t.position_size} lot{t.position_size === 1 ? "" : "s"}
                  </span>
                </Td>
                <Td mono>
                  {t.stop_price.toFixed(2)} ({fmtPct(m.toStopPct)} / {fmtR(m.toStopR)})
                </Td>
                <Td mono>
                  {t.target_price.toFixed(2)} ({fmtPct(m.toTargetPct)} / {fmtR(m.toTargetR)})
                </Td>
                <Td>{fmtDuration(t.entry_time)}</Td>
                <Td>
                  <div className="flex items-center gap-2">
                    {t.signal_id ? (
                      <Link
                        to="/signal/$id"
                        params={{ id: t.signal_id }}
                        className="text-xs text-primary hover:underline"
                      >
                        Signal
                      </Link>
                    ) : (
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Manual
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => onClose(t)}
                      className="rounded-md border border-border/70 px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-accent"
                    >
                      Close now
                    </button>

                    <MirrorTradeButton
                      paperTradeId={t.id}
                      lots={t.position_size}
                      mirrored={t.mirrored}
                      ticket={t.mirror_ticket}
                    />
                  </div>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Filter state lives on the page so the Accumulated Results strip matches. */
export interface ClosedFilters {
  reason: "all" | ExitReason;
  source: "all" | TradeSource;
  from: string;
  to: string;
}

export function applyClosedFilters(trades: PaperTradeRow[], f: ClosedFilters) {
  return trades
    .filter((t) => (f.reason === "all" ? true : t.exit_reason === f.reason))
    .filter((t) => (f.source === "all" ? true : t.source === f.source))
    .filter((t) => (f.from ? (t.exit_time ?? "") >= f.from : true))
    .filter((t) => (f.to ? (t.exit_time ?? "") <= f.to + "T23:59:59Z" : true))
    .sort((a, b) => (b.exit_time ?? "").localeCompare(a.exit_time ?? ""));
}

function ClosedTable({
  rows,
  filters,
  setFilters,
}: {
  rows: PaperTradeRow[];
  filters: ClosedFilters;
  setFilters: (f: ClosedFilters) => void;
}) {
  const { reason, source, from, to } = filters;
  const setReason = (v: "all" | ExitReason) => setFilters({ ...filters, reason: v });
  const setSource = (v: "all" | TradeSource) => setFilters({ ...filters, source: v });
  const setFrom = (v: string) => setFilters({ ...filters, from: v });
  const setTo = (v: string) => setFilters({ ...filters, to: v });

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-muted-foreground">
          Came from
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as "all" | TradeSource)}
            className="ml-2 rounded-md border border-border/70 bg-background px-2 py-1 text-xs text-foreground"
          >
            <option value="all">All</option>
            <option value="signal">{SOURCE_LABEL.signal}</option>
            <option value="manual">{SOURCE_LABEL.manual}</option>
          </select>
        </label>

        <label className="text-xs text-muted-foreground">
          Exit reason
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as "all" | ExitReason)}
            className="ml-2 rounded-md border border-border/70 bg-background px-2 py-1 text-xs text-foreground"
          >
            <option value="all">All</option>
            {(Object.keys(EXIT_REASON_LABEL) as ExitReason[]).map((r) => (
              <option key={r} value={r}>
                {EXIT_REASON_LABEL[r]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="ml-2 rounded-md border border-border/70 bg-background px-2 py-1 text-xs text-foreground"
          />
        </label>
        <label className="text-xs text-muted-foreground">
          To
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="ml-2 rounded-md border border-border/70 bg-background px-2 py-1 text-xs text-foreground"
          />
        </label>
      </div>

      {rows.length === 0 ? (
        <p className="mt-5 text-sm text-muted-foreground">No closed paper trades in this range.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-border/70">
          <table className="w-full text-sm">
            <thead className="bg-card/60 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <Th>Symbol</Th>
                <Th>Came from</Th>
                <Th>Dir</Th>
                <Th>Entry</Th>
                <Th>Exit</Th>
                <Th>Reason</Th>
                <Th>Realised</Th>
                <Th>Duration</Th>

              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const pct =
                  t.exit_price != null
                    ? ((t.direction === "long"
                        ? t.exit_price - t.entry_price
                        : t.entry_price - t.exit_price) /
                        t.entry_price) *
                      100
                    : null;
                const r =
                  t.exit_price != null && Math.abs(t.entry_price - t.stop_price) > 0
                    ? (t.direction === "long"
                        ? t.exit_price - t.entry_price
                        : t.entry_price - t.exit_price) /
                      Math.abs(t.entry_price - t.stop_price)
                    : null;
                return (
                  <tr key={t.id} className="border-t border-border/50">
                    <Td>
                      <TickerLink symbol={t.ticker} />
                      {t.both_touched && (
                        <span
                          className="ml-1 text-[9px] uppercase text-amber"
                          title="Stop and target were both touched in the same period — stop assumed first"
                        >
                          both
                        </span>
                      )}
                      {t.overrides_used && (
                        <span className="ml-1 text-[9px] uppercase text-muted-foreground">
                          ovr
                        </span>
                      )}
                    </Td>
                    <Td>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {SOURCE_LABEL[t.source]}
                      </span>
                    </Td>
                    <Td>

                      <span
                        className={t.direction === "long" ? "text-tailwind" : "text-headwind"}
                      >
                        {t.direction}
                      </span>
                    </Td>
                    <Td mono>{t.entry_price.toFixed(2)}</Td>
                    <Td mono>{t.exit_price != null ? t.exit_price.toFixed(2) : "—"}</Td>
                    <Td>{t.exit_reason ? EXIT_REASON_LABEL[t.exit_reason] : "—"}</Td>
                    <Td>
                      <span className={pctTone(t.realized_pnl)}>
                        {fmtMoney(t.realized_pnl)} · {fmtPct(pct)} · {fmtR(r)}
                      </span>
                    </Td>
                    <Td>{fmtDuration(t.entry_time, t.exit_time)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatsView({ trades: all, notional }: { trades: PaperTradeRow[]; notional: number }) {
  // Signal-based results are the default: they are what measures signal quality.
  const [set, setSet] = useState<TradeSource | "all">("signal");
  const trades = useMemo(
    () => (set === "all" ? all : all.filter((t) => t.source === set)),
    [all, set],
  );
  const stats = useMemo(() => computeStats(trades, notional), [trades, notional]);
  const curve = useMemo(() => equityCurve(trades, notional), [trades, notional]);
  const [split, setSplit] = useState<SplitKey>("conviction");
  const rows = useMemo(() => splitStats(trades, split, notional), [trades, split, notional]);

  const counts = {
    signal: all.filter((t) => t.source === "signal").length,
    manual: all.filter((t) => t.source === "manual").length,
    all: all.length,
  };

  const picker = (
    <div className="flex items-center gap-1 flex-wrap">
      {(
        [
          ["signal", `${SOURCE_LABEL.signal} (${counts.signal})`],
          ["manual", `${SOURCE_LABEL.manual} (${counts.manual})`],
          ["all", `All trades (${counts.all})`],
        ] as Array<[TradeSource | "all", string]>
      ).map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => setSet(key)}
          className={
            "rounded-md border px-2.5 py-1 text-xs transition-colors " +
            (set === key
              ? "border-primary/50 bg-primary/10 text-primary"
              : "border-border/70 text-muted-foreground hover:bg-accent")
          }
        >
          {label}
        </button>
      ))}
    </div>
  );

  if (all.length === 0) {
    return (
      <p className="mt-6 text-sm text-muted-foreground">
        No closed paper trades yet — statistics appear once trades resolve.
      </p>
    );
  }

  return (
    <div className="mt-5 space-y-6">
      {picker}
      {trades.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No closed trades in this set yet.
        </p>
      )}
      {trades.length > 0 && stats.count < SMALL_SAMPLE && (
        <div className="flex items-start gap-2 rounded-md border border-amber/40 bg-amber/10 p-3 text-xs text-amber">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Small sample: {stats.count} closed trade{stats.count === 1 ? "" : "s"}. Fewer than{" "}
          {SMALL_SAMPLE} is not evidence of anything.
        </div>
      )}


      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi
          label="Total realised P&L"
          value={fmtMoney(stats.totalPnl)}
          sub={`${fmtPct(stats.pctOfNotional)} of ${fmtMoney(notional)}`}
          tone={pctTone(stats.totalPnl)}
        />
        <Kpi
          label="Win rate"
          value={stats.winRate != null ? `${stats.winRate}%` : "—"}
          sub={`${stats.count} closed`}
        />
        <Kpi
          label="Avg win / avg loss"
          value={`${fmtMoney(stats.avgWin)} / ${fmtMoney(stats.avgLoss)}`}
          sub={`${fmtR(stats.avgWinR)} / ${fmtR(stats.avgLossR)}`}
        />
        <Kpi
          label="Profit factor"
          value={stats.profitFactor != null ? stats.profitFactor.toFixed(2) : "—"}
          sub="gross wins ÷ gross losses"
        />
        <Kpi
          label="Expectancy per trade"
          value={fmtMoney(stats.expectancy)}
          sub={fmtR(stats.expectancyR)}
          tone={pctTone(stats.expectancy)}
        />
        <Kpi label="Max drawdown" value={fmtMoney(-stats.maxDrawdown)} sub="of paper equity" />
        <Kpi
          label="Avg time in trade"
          value={stats.avgHoldHours != null ? `${stats.avgHoldHours}h` : "—"}
          sub="entry to exit"
        />
        <Kpi
          label="Both levels touched"
          value={String(trades.filter((t) => t.both_touched).length)}
          sub="stop assumed first"
        />
      </div>

      <section>
        <h2 className="text-sm font-semibold">Paper equity curve</h2>
        <EquityChart points={curve} />
      </section>

      <section>
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-sm font-semibold">Splits</h2>
          <select
            value={split}
            onChange={(e) => setSplit(e.target.value as SplitKey)}
            className="rounded-md border border-border/70 bg-background px-2 py-1 text-xs"
          >
            {(Object.keys(SPLIT_LABEL) as SplitKey[]).map((k) => (
              <option key={k} value={k}>
                {SPLIT_LABEL[k]}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-3 overflow-x-auto rounded-xl border border-border/70">
          <table className="w-full text-sm">
            <thead className="bg-card/60 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <Th>{SPLIT_LABEL[split]}</Th>
                <Th>Trades</Th>
                <Th>Realised</Th>
                <Th>Win rate</Th>
                <Th>Profit factor</Th>
                <Th>Expectancy</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.bucket} className="border-t border-border/50">
                  <Td>
                    {r.bucket}
                    {r.stats.count < SMALL_SAMPLE && (
                      <span className="ml-2 text-[9px] uppercase text-amber">small sample</span>
                    )}
                  </Td>
                  <Td>{r.stats.count}</Td>
                  <Td>
                    <span className={pctTone(r.stats.totalPnl)}>{fmtMoney(r.stats.totalPnl)}</span>
                  </Td>
                  <Td>{r.stats.winRate != null ? `${r.stats.winRate}%` : "—"}</Td>
                  <Td>{r.stats.profitFactor != null ? r.stats.profitFactor.toFixed(2) : "—"}</Td>
                  <Td>
                    {fmtMoney(r.stats.expectancy)} · {fmtR(r.stats.expectancyR)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function EquityChart({ points }: { points: Array<{ time: string; equity: number }> }) {
  if (points.length < 2) {
    return (
      <p className="mt-2 text-xs text-muted-foreground">
        The curve appears once at least one trade has closed.
      </p>
    );
  }
  const w = 640;
  const h = 160;
  const values = points.map((p) => p.equity);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const path = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((p.equity - min) / span) * (h - 10) - 5;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const up = values[values.length - 1]! >= values[0]!;
  return (
    <div className="mt-2 rounded-xl border border-border/70 bg-card/40 p-3">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-40" preserveAspectRatio="none">
        <path
          d={path}
          fill="none"
          strokeWidth="2"
          className={up ? "stroke-tailwind" : "stroke-headwind"}
        />
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{fmtMoney(values[0])}</span>
        <span>{fmtMoney(values[values.length - 1])}</span>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-card/60 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={"mt-1 text-lg font-semibold font-mono " + (tone ?? "")}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-3 py-2 text-left font-medium whitespace-nowrap">{children}</th>;
}

function Td({ children, mono }: { children?: React.ReactNode; mono?: boolean }) {
  return (
    <td className={"px-3 py-2 whitespace-nowrap " + (mono ? "font-mono" : "")}>{children}</td>
  );
}

/** Paper assumption vs what the demo account actually filled. */
function MirrorStats({ trades }: { trades: PaperTradeRow[] }) {
  const rows = useMemo(() => mirrorComparisons(trades), [trades]);
  const entryAvg = useMemo(() => averageSlippage(rows, "entry"), [rows]);
  const exitAvg = useMemo(() => averageSlippage(rows, "exit"), [rows]);

  if (rows.length === 0) {
    return (
      <section className="mt-8">
        <h2 className="text-sm font-semibold">Demo mirror comparison</h2>
        <p className="mt-2 text-xs text-muted-foreground">
          No trades have been mirrored to the demo account yet. Mirror an open trade to start
          measuring spread and slippage against the paper assumption.
        </p>
      </section>
    );
  }

  const fmtSlip = (v: { dollars: number; pct: number } | null) =>
    v == null ? "—" : `${v.dollars >= 0 ? "+" : ""}${v.dollars.toFixed(4)} (${v.pct >= 0 ? "+" : ""}${v.pct.toFixed(3)}%)`;

  return (
    <section className="mt-8 space-y-3">
      <h2 className="text-sm font-semibold">Demo mirror comparison</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Kpi
          label="Avg entry slippage"
          value={fmtSlip(entryAvg)}
          sub={entryAvg ? `${entryAvg.count} mirrored entries · positive is in your favour` : "—"}
        />
        <Kpi
          label="Avg exit slippage"
          value={fmtSlip(exitAvg)}
          sub={exitAvg ? `${exitAvg.count} mirrored exits · positive is in your favour` : "—"}
        />
      </div>
      <div className="overflow-x-auto rounded-xl border border-border/70">
        <table className="w-full text-sm">
          <thead className="bg-card/60 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <Th>Symbol</Th>
              <Th>Dir</Th>
              <Th>Paper entry</Th>
              <Th>Demo fill</Th>
              <Th>Entry slip</Th>
              <Th>Paper exit</Th>
              <Th>Demo close</Th>
              <Th>Exit slip</Th>
              <Th>Paper P&L</Th>
              <Th>Demo P&L</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.trade.id} className="border-t border-border/50">
                <Td>
                  <TickerLink symbol={r.trade.ticker} />
                </Td>
                <Td>{r.trade.direction}</Td>
                <Td mono>{r.trade.entry_price.toFixed(2)}</Td>
                <Td mono>{r.trade.demo_fill_price?.toFixed(4) ?? "—"}</Td>
                <Td mono>{fmtSlip(r.entry)}</Td>
                <Td mono>{r.trade.exit_price?.toFixed(2) ?? "—"}</Td>
                <Td mono>{r.trade.demo_close_price?.toFixed(4) ?? "—"}</Td>
                <Td mono>{fmtSlip(r.exit)}</Td>
                <Td>
                  <span className={pctTone(r.paperPnl)}>{fmtMoney(r.paperPnl)}</span>
                </Td>
                <Td>
                  <span className={pctTone(r.demoPnl)}>{fmtMoney(r.demoPnl)}</span>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Paper results stay the system of record. The demo column exists to show what spread,
        commission and slippage do to the same idea.
      </p>
    </section>
  );
}

/**
 * Persistent running total under the tables. Uses computeStats — the same source
 * of truth as the Stats tab — so the two can never disagree.
 */
function AccumulatedResults({
  closed,
  open,
  priceOf,
  notional,
  filtered,
  feedStale,
  lastQuoteTime,
}: {
  closed: PaperTradeRow[];
  open: PaperTradeRow[];
  priceOf: (t: PaperTradeRow) => number | null;
  notional: number;
  filtered: boolean;
  feedStale: boolean;
  lastQuoteTime: string | null;
}) {
  const stats = useMemo(() => computeStats(closed, notional), [closed, notional]);

  const unrealized = useMemo(() => {
    const values = open
      .map((t) => liveMetrics(t, priceOf(t)).pnl)
      .filter((v): v is number => v != null);
    return {
      total: values.reduce((a, b) => a + b, 0),
      priced: values.length,
      missing: open.length - values.length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pnls = closed.map((t) => Number(t.realized_pnl ?? 0));
  const best = pnls.length ? Math.max(...pnls) : null;
  const worst = pnls.length ? Math.min(...pnls) : null;
  const wins = pnls.filter((p) => p > 0).length;
  const losses = pnls.filter((p) => p < 0).length;
  const combined = stats.totalPnl + unrealized.total;
  const equity = notional + stats.totalPnl;

  const mirrored = closed.filter((t) => t.mirrored && t.demo_realized_pnl != null);
  const mirroredPaper = mirrored.reduce((s, t) => s + Number(t.realized_pnl ?? 0), 0);
  const mirroredDemo = mirrored.reduce((s, t) => s + Number(t.demo_realized_pnl ?? 0), 0);

  return (
    <section className="mt-10 rounded-xl border border-border/70 bg-card/40 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Accumulated results</h2>
        <span className="text-[11px] text-muted-foreground">
          {filtered ? "Filtered set" : "All time"} · n = {stats.count} closed trade
          {stats.count === 1 ? "" : "s"}
        </span>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Realized P&L"
          value={fmtMoney(stats.totalPnl)}
          sub={`${stats.pctOfNotional > 0 ? "+" : ""}${stats.pctOfNotional.toFixed(2)}% of ${fmtMoney(notional)} notional`}
          tone={pctTone(stats.totalPnl)}
        />
        <Kpi
          label="Unrealized P&L (open)"
          value={fmtMoney(unrealized.total)}
          sub={
            feedStale
              ? `Price feed stale${lastQuoteTime ? ` — last quote ${fmtDuration(lastQuoteTime)} ago` : ""}`
              : unrealized.missing > 0
                ? `${unrealized.priced} of ${open.length} open trades priced`
                : `${open.length} open trade${open.length === 1 ? "" : "s"}`
          }
          tone={feedStale ? "text-amber" : pctTone(unrealized.total)}
        />
        <Kpi
          label="Combined total"
          value={fmtMoney(combined)}
          sub="Realized + unrealized"
          tone={pctTone(combined)}
        />
        <Kpi
          label="Paper equity"
          value={fmtMoney(equity)}
          sub="Notional + realized P&L"
          tone={pctTone(stats.totalPnl)}
        />
        <Kpi
          label="Win rate"
          value={stats.winRate == null ? "—" : `${stats.winRate.toFixed(1)}%`}
          sub={`${wins} win${wins === 1 ? "" : "s"} / ${losses} loss${losses === 1 ? "" : "es"}`}
        />
        <Kpi
          label="Average win / loss"
          value={`${fmtMoney(stats.avgWin)} / ${fmtMoney(stats.avgLoss)}`}
          sub={`${fmtR(stats.avgWinR)} / ${fmtR(stats.avgLossR)}`}
        />
        <Kpi
          label="Expectancy per trade"
          value={fmtMoney(stats.expectancy)}
          sub={fmtR(stats.expectancyR)}
          tone={pctTone(stats.expectancy)}
        />
        <Kpi
          label="Best / worst trade"
          value={`${fmtMoney(best)} / ${fmtMoney(worst)}`}
          sub="Single closed trades"
        />
      </div>

      {mirrored.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-xs">
          <span className="text-muted-foreground">
            Mirrored to demo ({mirrored.length} trade{mirrored.length === 1 ? "" : "s"})
          </span>
          <span>
            Paper <span className={"font-mono " + pctTone(mirroredPaper)}>{fmtMoney(mirroredPaper)}</span>
          </span>
          <span>
            Demo <span className={"font-mono " + pctTone(mirroredDemo)}>{fmtMoney(mirroredDemo)}</span>
          </span>
          <span>
            Gap{" "}
            <span className={"font-mono " + pctTone(mirroredDemo - mirroredPaper)}>
              {fmtMoney(mirroredDemo - mirroredPaper)}
            </span>{" "}
            <span className="text-muted-foreground">spread, commission and slippage</span>
          </span>
        </div>
      )}

      {stats.count < SMALL_SAMPLE && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          Small sample — early results are lumpy by nature. Expectancy only starts meaning
          something past a few dozen closed trades, the same threshold as the Scorecard review.
        </p>
      )}
    </section>
  );
}
