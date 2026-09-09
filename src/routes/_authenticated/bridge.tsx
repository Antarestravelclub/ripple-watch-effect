import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Copy,
  Download,
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { SiteShell } from "@/components/site-shell";
import {
  getBridgeConfig,
  regenerateBridgeSecret,
  setAllowedAccount,
} from "@/lib/bridge-config.functions";
import { getDemoAccount } from "@/lib/bridge.functions";

export const Route = createFileRoute("/_authenticated/bridge")({
  head: () => ({
    meta: [
      { title: "Bridge Setup — The Ripple Effect" },
      {
        name: "description",
        content:
          "Step-by-step setup for connecting your MetaTrader 5 demo terminal to The Ripple Effect through the local Python bridge helper.",
      },
      { property: "og:title", content: "Bridge Setup — The Ripple Effect" },
      {
        property: "og:description",
        content: "Connect your MT5 demo terminal to the site with the local bridge helper.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BridgePage,
});

/* ------------------------------- primitives ------------------------------- */

function CopyButton({ value, label }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        } catch {
          /* clipboard blocked — the value is selectable on screen */
        }
      }}
      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border/70 px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent"
      aria-label={`Copy ${label ?? "value"}`}
    >
      {done ? <Check className="h-3 w-3 text-tailwind" /> : <Copy className="h-3 w-3" />}
      {done ? "Copied" : "Copy"}
    </button>
  );
}

function Panel({
  n,
  title,
  subtitle,
  children,
  defaultOpen = false,
}: {
  n: number;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-xl border border-border/70 bg-card/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-[11px] font-semibold text-primary">
          {n}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{title}</span>
          {subtitle && (
            <span className="block text-xs text-muted-foreground">{subtitle}</span>
          )}
        </span>
        <ChevronDown
          className={"h-4 w-4 shrink-0 text-muted-foreground transition-transform " + (open ? "rotate-180" : "")}
        />
      </button>
      {open && <div className="border-t border-border/60 px-4 py-4 text-sm">{children}</div>}
    </section>
  );
}

function ValueRow({
  label,
  value,
  mono = true,
  children,
}: {
  label: string;
  value?: string;
  mono?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border/40 py-2 last:border-0">
      <span className="w-52 shrink-0 text-xs text-muted-foreground">{label}</span>
      {children ?? (
        <>
          <span className={"min-w-0 flex-1 break-all text-xs " + (mono ? "font-mono" : "")}>
            {value}
          </span>
          {value && <CopyButton value={value} label={label} />}
        </>
      )}
    </div>
  );
}

function Cmd({ children }: { children: string }) {
  return (
    <div className="mt-1 flex items-center gap-2 rounded-md border border-border/70 bg-background px-2 py-1.5">
      <code className="min-w-0 flex-1 break-all font-mono text-xs">{children}</code>
      <CopyButton value={children} label="command" />
    </div>
  );
}

/* --------------------------------- page ---------------------------------- */

function BridgePage() {
  const load = useServerFn(getBridgeConfig);
  const rotate = useServerFn(regenerateBridgeSecret);
  const saveAccount = useServerFn(setAllowedAccount);
  const fetchDemo = useServerFn(getDemoAccount);
  const qc = useQueryClient();

  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  const { data: cfg, isLoading } = useQuery({
    queryKey: ["bridge-config"],
    queryFn: () => load(),
  });
  const { data: demo } = useQuery({
    queryKey: ["demo-account"],
    queryFn: () => fetchDemo(),
    refetchInterval: 30_000,
  });

  const [reveal, setReveal] = useState(false);
  const [account, setAccount] = useState("");
  const [confirmRotate, setConfirmRotate] = useState(false);
  useEffect(() => {
    if (cfg?.allowedAccount != null) setAccount(cfg.allowedAccount);
  }, [cfg?.allowedAccount]);

  const rotateMut = useMutation({
    mutationFn: () => rotate(),
    onSuccess: () => {
      setConfirmRotate(false);
      qc.invalidateQueries({ queryKey: ["bridge-config"] });
    },
  });
  const accountMut = useMutation({
    mutationFn: () => saveAccount({ data: { allowedAccount: account } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bridge-config"] }),
  });

  const configJson = useMemo(() => {
    if (!cfg) return "";
    return JSON.stringify(
      {
        SITE_BASE_URL: origin,
        BRIDGE_SECRET: cfg.secret,
        ALLOWED_ACCOUNT: cfg.allowedAccount ? Number(cfg.allowedAccount) : 0,
        EXECUTION_ENABLED: false,
        MAX_LOTS_PER_ORDER: cfg.maxLotsPerOrder,
        ACCOUNT_POST_INTERVAL_S: cfg.accountPostIntervalS,
        DEALS_POST_INTERVAL_S: cfg.dealsPostIntervalS,
        INSTRUCTION_POLL_INTERVAL_S: cfg.instructionPollIntervalS,
      },
      null,
      2,
    );
  }, [cfg, origin]);

  function downloadConfig() {
    const blob = new Blob([configJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bridge_config.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <SiteShell>
      <h1 className="text-2xl font-semibold tracking-tight">Bridge Setup</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Connect your MetaTrader 5 demo terminal to this site. Work down the panels in order; the
        last one turns green once your machine starts reporting.
      </p>

      <div className="mt-5 space-y-3">
        <Panel n={1} title="Why there is no broker login here" defaultOpen>
          <p className="text-muted-foreground">
            MetaTrader 5 never lets a website hold broker credentials. Your MT5 login, password and
            server stay inside the MT5 terminal on your own machine.
          </p>
          <p className="mt-2 text-muted-foreground">
            This page controls a small program — the bridge helper — that runs next to MT5, reads
            account state directly from the broker, and, only when you switch it on yourself,
            mirrors demo trades. The site never sees your broker password.
          </p>
        </Panel>

        <Panel n={2} title="Pick an execution bridge" subtitle="Python bridge recommended">
          <div className="flex gap-2">
            <span className="rounded-md border border-primary/50 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
              Python bridge · active
            </span>
            <span
              className="cursor-not-allowed rounded-md border border-border/60 px-3 py-1.5 text-xs text-muted-foreground opacity-60"
              aria-disabled="true"
            >
              Expert Advisor (MQL5) · coming later
            </span>
          </div>
          <p className="mt-3 text-muted-foreground">
            Runs as a small Python program next to your MT5 terminal. Works on any Windows machine
            or VPS with Python installed.
          </p>
        </Panel>

        <Panel n={3} title="Install the Python bridge">
          <ol className="space-y-4">
            <li>
              <p className="font-medium">1. Install Python 3.10 or newer</p>
              <p className="text-xs text-muted-foreground">
                Get it from python.org and tick “Add Python to PATH” during install.
              </p>
            </li>
            <li>
              <p className="font-medium">2. Download the two files</p>
              <div className="mt-1 flex flex-wrap gap-2">
                <a
                  href="/ripple_bridge_helper.py"
                  download
                  className="inline-flex items-center gap-1.5 rounded-md border border-border/70 px-3 py-1.5 text-xs hover:bg-accent"
                >
                  <Download className="h-3.5 w-3.5" /> Download ripple_bridge_helper.py
                </a>
                <button
                  type="button"
                  onClick={downloadConfig}
                  disabled={!cfg}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-60"
                >
                  <Download className="h-3.5 w-3.5" /> Download bridge_config.json
                </button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                The config comes pre-filled with this account's real values — nothing to edit by
                hand except the account number, which you can set in panel 5 first.
              </p>
            </li>
            <li>
              <p className="font-medium">3. Put both files in one folder and install the packages</p>
              <p className="text-xs text-muted-foreground">
                Open Command Prompt in that folder and run:
              </p>
              <Cmd>pip install MetaTrader5 requests</Cmd>
            </li>
            <li>
              <p className="font-medium">4. Make sure MT5 is running and logged into the demo account</p>
            </li>
            <li>
              <p className="font-medium">5. Start the helper</p>
              <Cmd>python ripple_bridge_helper.py</Cmd>
              <p className="mt-1 text-xs text-muted-foreground">
                Leave the window open. The Live connection panel below should go green within about
                a minute.
              </p>
            </li>
          </ol>
        </Panel>

        <Panel n={4} title="Allow the API URL in MT5" subtitle="Only needed later, harmless now">
          <p className="text-muted-foreground">
            The Python helper does not need this. Setting it now saves a step if you later switch to
            the Expert Advisor version: in MT5 go to Tools → Options → Expert Advisors → “Allow
            WebRequest for listed URL” and add:
          </p>
          <ValueRow label="Site base URL" value={origin} />
        </Panel>

        <Panel n={5} title="Bridge config values" defaultOpen>
          <p className="rounded-md border border-amber/40 bg-amber/10 p-2 text-xs text-amber">
            This workspace has a private bridge secret for your account. Never share it or commit it
            to source.
          </p>

          {isLoading && (
            <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Preparing your bridge secret…
            </p>
          )}

          {cfg && (
            <div className="mt-3">
              <ValueRow label="SITE_BASE_URL" value={origin} />

              <ValueRow label="BRIDGE_SECRET">
                <span className="min-w-0 flex-1 break-all font-mono text-xs">
                  {reveal ? cfg.secret : "•".repeat(32)}
                </span>
                <button
                  type="button"
                  onClick={() => setReveal((v) => !v)}
                  className="inline-flex items-center gap-1 rounded-md border border-border/70 px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent"
                >
                  {reveal ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  {reveal ? "Hide" : "Reveal"}
                </button>
                <CopyButton value={cfg.secret} label="bridge secret" />
                <button
                  type="button"
                  onClick={() => setConfirmRotate(true)}
                  className="inline-flex items-center gap-1 rounded-md border border-border/70 px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent"
                >
                  <RefreshCw className="h-3 w-3" /> Regenerate
                </button>
              </ValueRow>

              <ValueRow label="ALLOWED_ACCOUNT">
                <input
                  value={account}
                  onChange={(e) => setAccount(e.target.value.replace(/[^\d]/g, ""))}
                  placeholder="Demo account login number"
                  className="min-w-0 flex-1 rounded-md border border-border/70 bg-background px-2 py-1 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => accountMut.mutate()}
                  disabled={accountMut.isPending}
                  className="rounded-md bg-primary px-2 py-1 text-[11px] text-primary-foreground disabled:opacity-60"
                >
                  Save
                </button>
              </ValueRow>
              {accountMut.error && (
                <p className="text-xs text-headwind">
                  {accountMut.error instanceof Error ? accountMut.error.message : "Could not save"}
                </p>
              )}

              <ValueRow label="EXECUTION_ENABLED" value="false" />
              <p className="pt-1 text-xs text-muted-foreground">
                Leave false until the live connection below is verified. Enable it in the config
                file only when you are ready to mirror trades.
              </p>

              <ValueRow label="MAX_LOTS_PER_ORDER" value={String(cfg.maxLotsPerOrder)} />
              <ValueRow label="ACCOUNT_POST_INTERVAL_S" value={String(cfg.accountPostIntervalS)} />
              <ValueRow label="DEALS_POST_INTERVAL_S" value={String(cfg.dealsPostIntervalS)} />
              <ValueRow
                label="INSTRUCTION_POLL_INTERVAL_S"
                value={String(cfg.instructionPollIntervalS)}
              />

              <div className="mt-3 flex items-center gap-2">
                <CopyButton value={configJson} label="whole config" />
                <span className="text-xs text-muted-foreground">
                  Copies the complete bridge_config.json contents.
                </span>
              </div>
            </div>
          )}
        </Panel>

        <Panel n={6} title="Live connection" defaultOpen>
          <LiveConnection
            status={demo?.status ?? "offline"}
            account={demo?.account ?? null}
            lastSeen={demo?.lastSeen ?? null}
            brokerServer={cfg?.brokerServer ?? null}
          />
        </Panel>
      </div>

      {confirmRotate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
          <div className="w-full max-w-sm rounded-xl border border-border/70 bg-card p-5">
            <h2 className="text-base font-semibold">Regenerate bridge secret?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              The helper will disconnect until you update its config with the new secret.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmRotate(false)}
                className="rounded-md border border-border/70 px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => rotateMut.mutate()}
                disabled={rotateMut.isPending}
                className="inline-flex items-center gap-2 rounded-md bg-destructive px-3 py-1.5 text-xs text-destructive-foreground disabled:opacity-60"
              >
                {rotateMut.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                Regenerate
              </button>
            </div>
          </div>
        </div>
      )}
    </SiteShell>
  );
}

function LiveConnection({
  status,
  account,
  lastSeen,
  brokerServer,
}: {
  status: string;
  account: {
    masked: string;
    mode: string;
    currency: string | null;
    balance: number | null;
    equity: number | null;
  } | null;
  lastSeen: string | null;
  brokerServer: string | null;
}) {
  const tone =
    status === "connected"
      ? { dot: "bg-tailwind", text: "text-tailwind", label: "Online" }
      : status === "stale"
        ? { dot: "bg-amber", text: "text-amber", label: "Stale — no update for over 2 minutes" }
        : { dot: "bg-destructive", text: "text-destructive", label: "Offline" };
  const isLive = account?.mode === "live";
  const money = (v: number | null | undefined) =>
    v == null
      ? "—"
      : `${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${
          account?.currency ? ` ${account.currency}` : ""
        }`;

  return (
    <div>
      {isLive && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-destructive bg-destructive/15 px-3 py-2 text-xs font-semibold text-destructive">
          <AlertTriangle className="h-4 w-4" />
          Live account connected — mirroring disabled.
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <span className={"flex items-center gap-2 text-sm font-medium " + tone.text}>
          <span className={"h-2.5 w-2.5 rounded-full " + tone.dot} />
          {tone.label}
        </span>
        {account && (
          <span
            className={
              "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase " +
              (isLive
                ? "border-destructive/50 bg-destructive/10 text-destructive"
                : "border-tailwind/40 bg-tailwind/10 text-tailwind")
            }
          >
            {account.mode}
          </span>
        )}
      </div>

      {account ? (
        <div className="mt-3">
          <ValueRow label="Broker server" value={brokerServer ?? "—"} />
          <ValueRow label="Account number" value={account.masked} />
          <ValueRow label="Balance" value={money(account.balance)} />
          <ValueRow label="Equity" value={money(account.equity)} />
          <ValueRow
            label="Last update"
            value={lastSeen ? new Date(lastSeen).toLocaleString() : "—"}
          />
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          Waiting for first report from the helper…
        </p>
      )}
    </div>
  );
}
