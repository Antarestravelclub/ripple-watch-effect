import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteShell } from "@/components/site-shell";
import { TickerLink } from "@/components/ticker-link";
import { getBrokerActivity } from "@/lib/broker.functions";
import { BridgeSetup } from "@/components/bridge-setup";
import { ShieldCheck, Activity } from "lucide-react";

export const Route = createFileRoute("/broker")({
  head: () => ({
    meta: [
      { title: "Demo Account Bridge — The Ripple Effect" },
      {
        name: "description",
        content:
          "Monitor the demo-only MetaTrader 5 bridge: queued orders, fills, rejections and terminal status. Demo accounts only — no funded account can be reached.",
      },
      { property: "og:title", content: "Demo Account Bridge — The Ripple Effect" },
      {
        property: "og:description",
        content:
          "Queued orders, fills and demo terminal status for automated demo-account testing.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BrokerPage,
});

const STATUS_TONE: Record<string, string> = {
  queued: "text-muted-foreground border-border",
  claimed: "text-primary border-primary/40",
  filled: "text-tailwind border-tailwind/40",
  rejected: "text-headwind border-headwind/40",
  skipped: "text-muted-foreground border-border",
};

function ago(iso: string | null | undefined) {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  return h < 48 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

function BrokerPage() {
  const fetchActivity = useServerFn(getBrokerActivity);
  const { data, isLoading } = useQuery({
    queryKey: ["broker-activity"],
    queryFn: () => fetchActivity(),
    refetchInterval: 30_000,
  });

  const hb = data?.heartbeat ?? null;
  const liveBridge = hb && Date.now() - new Date(hb.seen_at).getTime() < 10 * 60_000;

  return (
    <SiteShell>
      <div className="max-w-4xl">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          Demo Account Bridge
        </h1>
        <p className="text-sm text-muted-foreground mt-1 mb-4">
          Signals that clear conviction are queued as demo orders automatically. A helper
          program running beside your MetaTrader 5 demo terminal picks them up, places them,
          and reports the result back here.
        </p>

        <div className="rounded-xl border border-tailwind/30 bg-tailwind/5 p-3 mb-5 flex gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-tailwind shrink-0 mt-0.5" />
          <span>
            <span className="text-foreground font-medium">Demo accounts only.</span> Every
            order is stamped demo and the database rejects anything else. If the helper
            reports a non-demo account, the app refuses to hand it any orders. Nothing on
            this page can move real money.
          </span>
        </div>

        <div className="mb-5 text-xs">
          <Link
            to="/admin/broker-symbols"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card/60 px-3 py-1.5 hover:bg-primary/10 transition-colors"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            Manage broker symbol mapping
          </Link>
        </div>

        <BridgeSetup
          configured={Boolean(data?.configured)}
          everSeen={Boolean(hb)}
          fresh={Boolean(liveBridge)}
          isDemo={hb?.account_is_demo ?? null}
          symbolUpload={data?.symbolUpload ?? null}
        />

        {/* Bridge status */}
        <section className="rounded-xl border border-border/70 bg-card/60 p-4 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <Activity
              className={"h-4 w-4 " + (liveBridge ? "text-tailwind" : "text-muted-foreground")}
            />
            <h2 className="text-sm font-semibold tracking-tight">Terminal status</h2>
            <span className="ml-auto text-[11px] text-muted-foreground">
              last check-in {ago(hb?.seen_at)}
            </span>
          </div>
          {!data?.configured ? (
            <p className="text-xs text-muted-foreground">
              The bridge key has not been saved yet, so the helper cannot connect. Ask me to
              set it up and I will walk you through it.
            </p>
          ) : !hb ? (
            <p className="text-xs text-muted-foreground">
              No helper has ever checked in. Run the helper program on the machine with your
              MetaTrader 5 demo terminal open.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {[
                ["Account", hb.account_login ?? "—"],
                ["Server", hb.account_server ?? "—"],
                ["Type", hb.account_is_demo === false ? "NOT DEMO" : "Demo"],
                [
                  "Equity",
                  hb.equity == null ? "—" : `${hb.equity.toFixed(2)} ${hb.currency ?? ""}`,
                ],
                [
                  "Balance",
                  hb.balance == null ? "—" : `${hb.balance.toFixed(2)} ${hb.currency ?? ""}`,
                ],
                ["Open positions", hb.open_positions ?? "—"],
                ["Helper version", hb.bridge_version ?? "—"],
                ["Note", hb.note ?? "—"],
              ].map(([k, v]) => (
                <div
                  key={String(k)}
                  className="rounded-lg border border-border/60 bg-background/40 px-2.5 py-2"
                >
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {k}
                  </div>
                  <div className="mt-0.5 font-mono">{String(v)}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Orders */}
        <section className="mb-5">
          <div className="flex items-baseline gap-3 mb-2">
            <h2 className="text-sm font-semibold tracking-tight">Order queue</h2>
            <span className="text-[11px] text-muted-foreground">
              {Object.entries(data?.counts ?? {})
                .map(([k, v]) => `${v} ${k}`)
                .join(" · ") || (isLoading ? "loading…" : "nothing queued yet")}
            </span>
          </div>
          {(data?.orders?.length ?? 0) === 0 ? (
            <p className="text-xs text-muted-foreground">
              No demo orders yet. Orders appear as soon as a signal scores 55 or higher with
              a size, a stop and a target.
            </p>
          ) : (
            <div className="rounded-xl border border-border/70 bg-card/40 overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground uppercase tracking-wider text-[10px]">
                  <tr className="border-b border-border/60">
                    <th className="text-left p-2">When</th>
                    <th className="text-left p-2">Symbol</th>
                    <th className="text-left p-2">Action</th>
                    <th className="text-right p-2">Ref</th>
                    <th className="text-right p-2">Stop</th>
                    <th className="text-right p-2">Target</th>
                    <th className="text-right p-2">Fill</th>
                    <th className="text-left p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data!.orders.map((o) => (
                    <tr key={o.id} className="border-b border-border/40 last:border-b-0">
                      <td className="p-2 text-muted-foreground whitespace-nowrap">
                        {ago(o.created_at)}
                      </td>
                      <td className="p-2 font-mono">
                        <TickerLink symbol={o.ticker} />
                        {o.broker_symbol && o.broker_symbol !== o.ticker && (
                          <span className="ml-1 text-[10px] text-muted-foreground">
                            {o.broker_symbol}
                          </span>
                        )}
                      </td>
                      <td className="p-2">
                        <span
                          className={
                            "font-mono text-[10px] " +
                            (o.side === "buy" ? "text-tailwind" : "text-headwind")
                          }
                        >
                          {o.side.toUpperCase()}
                        </span>
                        <span className="ml-1 text-[10px] text-muted-foreground">
                          {o.intent}
                        </span>
                      </td>
                      <td className="p-2 text-right font-mono tabular-nums">
                        {o.reference_price?.toFixed(2) ?? "—"}
                      </td>
                      <td className="p-2 text-right font-mono tabular-nums">
                        {o.stop_price?.toFixed(2) ?? "—"}
                      </td>
                      <td className="p-2 text-right font-mono tabular-nums">
                        {o.target_price?.toFixed(2) ?? "—"}
                      </td>
                      <td className="p-2 text-right font-mono tabular-nums">
                        {o.filled_price?.toFixed(2) ?? "—"}
                      </td>
                      <td className="p-2">
                        <span
                          className={
                            "inline-block rounded border px-1.5 py-0.5 text-[10px] " +
                            (STATUS_TONE[o.status] ?? "text-muted-foreground border-border")
                          }
                          title={o.error ?? undefined}
                        >
                          {o.status}
                        </span>
                        {o.error && (
                          <span className="ml-1 text-[10px] text-headwind">{o.error}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border/70 bg-card/60 p-4 text-xs text-muted-foreground space-y-2">
          <h2 className="text-sm font-semibold text-foreground">Setting up the helper</h2>
          <p>
            MetaTrader 5 has no web API, so it cannot be reached from a website. The helper
            program (<span className="font-mono">bridge/mt5_bridge.py</span> in this project)
            runs on the Windows machine where your demo terminal is logged in. It asks this
            app for new orders every 30 seconds, places them with the stop and target
            attached, and reports fills back.
          </p>
          <p>
            Instructions are in <span className="font-mono">bridge/README.md</span>. Note
            that most MetaTrader brokers only offer indices, currencies, metals and a limited
            share CFD list, so some symbols will come back as{" "}
            <span className="font-mono">skipped — symbol not available</span>. That is the
            broker, not a fault here.
          </p>
          <p>
            <Link to="/manual" className="text-primary hover:underline">
              Read the manual
            </Link>{" "}
            for how conviction, stops and targets are calculated before you judge the
            results.
          </p>
        </section>

        <p className="text-[11px] text-muted-foreground mt-4">
          Demo simulation only. Educational research — not investment advice, and not an
          instruction to trade.
        </p>
      </div>
    </SiteShell>
  );
}
