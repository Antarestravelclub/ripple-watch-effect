import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, ChevronDown, ChevronRight, PauseCircle, PlayCircle } from "lucide-react";
import { getDemoAccount, setMirroringPaused } from "@/lib/bridge.functions";

function money(v: number | null | undefined, currency: string | null | undefined) {
  if (v == null) return "—";
  return `${v < 0 ? "-" : ""}${currency ? "" : "$"}${Math.abs(v).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}${currency ? ` ${currency}` : ""}`;
}

function num(v: number | null | undefined, digits = 2) {
  return v == null ? "—" : v.toLocaleString(undefined, { maximumFractionDigits: digits });
}

const STATUS_STYLE: Record<string, string> = {
  connected: "border-tailwind/40 bg-tailwind/10 text-tailwind",
  stale: "border-headwind/40 bg-headwind/10 text-headwind",
  offline: "border-destructive/40 bg-destructive/10 text-destructive",
};

const STATUS_LABEL: Record<string, string> = {
  connected: "Connected",
  stale: "Stale — no update for over 2 minutes",
  offline: "Offline — no update for over 10 minutes",
};

export function DemoAccountPanel() {
  const queryClient = useQueryClient();
  const fetchDemo = useServerFn(getDemoAccount);
  const pauseFn = useServerFn(setMirroringPaused);
  const [showDeals, setShowDeals] = useState(false);
  const [showLog, setShowLog] = useState(false);

  const { data } = useQuery({
    queryKey: ["demo-account"],
    queryFn: () => fetchDemo(),
    refetchInterval: 30_000,
  });

  const pause = useMutation({
    mutationFn: (paused: boolean) => pauseFn({ data: { paused } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["demo-account"] }),
  });

  const currency = data?.account?.currency ?? null;
  const isLive = data?.account?.mode === "live";
  const lastSeen = useMemo(
    () => (data?.lastSeen ? new Date(data.lastSeen).toLocaleTimeString() : null),
    [data?.lastSeen],
  );

  return (
    <section className="rounded-xl border border-border/70 bg-card/60 p-4 mb-5">
      {isLive && (
        <div className="mb-3 rounded-lg border border-destructive bg-destructive/15 px-3 py-2 text-xs text-destructive font-semibold flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Live account connected — mirroring disabled.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-3">
        <h2 className="text-sm font-semibold tracking-tight">Demo Account</h2>
        {data?.account && (
          <>
            <span className="font-mono text-xs text-muted-foreground">
              {data.account.masked}
            </span>
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                isLive
                  ? "border-destructive/50 bg-destructive/10 text-destructive"
                  : "border-primary/40 bg-primary/10 text-primary"
              }`}
            >
              {data.account.mode}
            </span>
          </>
        )}
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
            STATUS_STYLE[data?.status ?? "offline"]
          }`}
        >
          {STATUS_LABEL[data?.status ?? "offline"]}
          {lastSeen ? ` · ${lastSeen}` : ""}
        </span>
      </div>

      {!data?.account ? (
        <p className="text-xs text-muted-foreground">
          No demo account has reported in yet. Start the bridge helper on your Windows machine —
          this panel fills in by itself within a minute.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-4">
          {[
            ["Balance", money(data.account.balance, currency)],
            ["Equity", money(data.account.equity, currency)],
            ["Floating P&L", money(data.floatingPnl, currency)],
            ["Free margin", money(data.account.freeMargin, currency)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-border/60 bg-background/40 p-2">
              <div className="text-muted-foreground">{label}</div>
              <div className="text-sm font-semibold text-foreground tabular-nums">{value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button
          type="button"
          disabled={pause.isPending || isLive}
          onClick={() => pause.mutate(!(data?.mirroringPaused ?? true))}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
            data?.mirroringPaused
              ? "border-border bg-card/60 hover:bg-primary/10"
              : "border-headwind/50 bg-headwind/10 text-headwind hover:bg-headwind/20"
          }`}
        >
          {data?.mirroringPaused ? (
            <>
              <PlayCircle className="h-3.5 w-3.5" /> Mirroring paused — allow mirroring
            </>
          ) : (
            <>
              <PauseCircle className="h-3.5 w-3.5" /> Pause all mirroring
            </>
          )}
        </button>
        <span className="text-[11px] text-muted-foreground">
          Mirroring is opt-in per trade, demo only, max {num(data?.maxLotsPerTrade)} lots per trade.
        </span>
      </div>

      <div className="mb-4">
        <h3 className="text-xs font-semibold text-foreground mb-1.5">Open positions</h3>
        {(data?.positions ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground">No open positions on the demo account.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr className="text-left">
                  <th className="py-1 pr-3">Symbol</th>
                  <th className="py-1 pr-3">Side</th>
                  <th className="py-1 pr-3 text-right">Lots</th>
                  <th className="py-1 pr-3 text-right">Open</th>
                  <th className="py-1 pr-3 text-right">Current</th>
                  <th className="py-1 pr-3 text-right">SL / TP</th>
                  <th className="py-1 text-right">Profit</th>
                </tr>
              </thead>
              <tbody>
                {(data?.positions ?? []).map((p) => (
                  <tr key={p.ticket} className="border-t border-border/40">
                    <td className="py-1.5 pr-3 font-mono">{p.symbol}</td>
                    <td className="py-1.5 pr-3 uppercase">{p.direction}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{num(p.lots)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{num(p.open_price, 5)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">
                      {num(p.current_price, 5)}
                    </td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">
                      {num(p.sl, 5)} / {num(p.tp, 5)}
                    </td>
                    <td
                      className={`py-1.5 text-right tabular-nums ${
                        (p.profit ?? 0) >= 0 ? "text-tailwind" : "text-headwind"
                      }`}
                    >
                      {money(p.profit, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowDeals((v) => !v)}
        className="flex items-center gap-1.5 text-xs font-semibold text-foreground mb-2"
      >
        {showDeals ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        Closed deals ({(data?.deals ?? []).length})
      </button>
      {showDeals && (
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr className="text-left">
                <th className="py-1 pr-3">Closed</th>
                <th className="py-1 pr-3">Symbol</th>
                <th className="py-1 pr-3">Side</th>
                <th className="py-1 pr-3 text-right">Lots</th>
                <th className="py-1 pr-3 text-right">Open</th>
                <th className="py-1 pr-3 text-right">Close</th>
                <th className="py-1 text-right">P&L</th>
              </tr>
            </thead>
            <tbody>
              {(data?.deals ?? []).map((d) => (
                <tr key={d.deal_id} className="border-t border-border/40">
                  <td className="py-1.5 pr-3">
                    {d.close_time ? new Date(d.close_time).toLocaleString() : "—"}
                  </td>
                  <td className="py-1.5 pr-3 font-mono">{d.symbol}</td>
                  <td className="py-1.5 pr-3 uppercase">{d.direction ?? "—"}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{num(d.lots)}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{num(d.open_price, 5)}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{num(d.close_price, 5)}</td>
                  <td
                    className={`py-1.5 text-right tabular-nums ${
                      (d.profit ?? 0) >= 0 ? "text-tailwind" : "text-headwind"
                    }`}
                  >
                    {money(d.profit, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowLog((v) => !v)}
        className="flex items-center gap-1.5 text-xs font-semibold text-foreground"
      >
        {showLog ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        Instructions log ({(data?.instructions ?? []).length})
      </button>
      {showLog && (
        <div className="overflow-x-auto mt-2">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr className="text-left">
                <th className="py-1 pr-3">Created</th>
                <th className="py-1 pr-3">Action</th>
                <th className="py-1 pr-3">Symbol</th>
                <th className="py-1 pr-3 text-right">Lots</th>
                <th className="py-1 pr-3">Status</th>
                <th className="py-1 pr-3 text-right">Fill</th>
                <th className="py-1">Detail</th>
              </tr>
            </thead>
            <tbody>
              {(data?.instructions ?? []).map((i) => (
                <tr key={i.id} className="border-t border-border/40">
                  <td className="py-1.5 pr-3">{new Date(i.created_at).toLocaleString()}</td>
                  <td className="py-1.5 pr-3">{i.action}</td>
                  <td className="py-1.5 pr-3 font-mono">{i.broker_symbol}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{num(i.lots)}</td>
                  <td className="py-1.5 pr-3">{i.status}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{num(i.fill_price, 5)}</td>
                  <td className="py-1.5 text-muted-foreground">{i.status_detail ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-[11px] text-muted-foreground">
        Demo execution only — no funded account can ever be reached from this app. Paper results
        remain the record; the demo account exists to measure spread and slippage.
      </p>
    </section>
  );
}
