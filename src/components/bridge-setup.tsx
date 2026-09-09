import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, X, Copy, Apple, Monitor } from "lucide-react";

interface Props {
  configured: boolean;
  everSeen: boolean;
  fresh: boolean;
  isDemo: boolean | null;
  symbolUpload: { created_at: string; symbol_count: number | null } | null;
}

function Step({ done, label }: { done: boolean; label: string }) {
  return (
    <li className="flex items-start gap-2">
      {done ? (
        <Check className="h-3.5 w-3.5 text-tailwind shrink-0 mt-0.5" />
      ) : (
        <X className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
      )}
      <span className={done ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </li>
  );
}

function CopyBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre className="rounded-lg border border-border/60 bg-background/60 p-3 pr-10 text-[11px] font-mono overflow-x-auto whitespace-pre">
        {text}
      </pre>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="absolute right-2 top-2 rounded-md border border-border/60 bg-card/80 p-1.5 hover:bg-primary/10 transition-colors"
        aria-label="Copy to clipboard"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-tailwind" />
        ) : (
          <Copy className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>
    </div>
  );
}

export function BridgeSetup({ configured, everSeen, fresh, isDemo, symbolUpload }: Props) {
  const origin =
    typeof window === "undefined" ? "https://ripple-watch-effect.lovable.app" : window.location.origin;

  const commands = [
    "pip install MetaTrader5 requests",
    "",
    `set RIPPLE_BASE_URL=${origin}`,
    "set RIPPLE_BRIDGE_KEY=paste-your-bridge-key-here",
    "set RIPPLE_LOT=0.10",
    "python ripple_bridge_helper.py",
  ].join("\n");

  return (
    <section className="rounded-xl border border-border/70 bg-card/60 p-4 mb-5">
      <h2 className="text-sm font-semibold tracking-tight mb-3">
        Connect your demo account
      </h2>

      <ol className="grid gap-1.5 text-xs mb-4">
        <Step done={configured} label="Bridge key saved in the app" />
        <Step done={everSeen} label="Helper program has checked in at least once" />
        <Step done={fresh} label="Helper checked in within the last 10 minutes" />
        <Step done={isDemo === true} label="Terminal confirmed to be a demo account" />
        <Step
          done={Boolean(symbolUpload)}
          label={
            symbolUpload
              ? `Broker symbol list uploaded (${symbolUpload.symbol_count ?? 0} symbols)`
              : "Broker symbol list uploaded (optional, improves matching)"
          }
        />
      </ol>

      {!fresh && (
        <p className="text-xs text-muted-foreground mb-4 rounded-lg border border-border/60 bg-background/40 px-3 py-2">
          {everSeen
            ? "Waiting for your helper… it last checked in a while ago. Make sure the window is still open on the Windows machine."
            : "Waiting for your helper… this page updates by itself the moment it connects."}
        </p>
      )}

      <div className="space-y-3 text-xs text-muted-foreground">
        <div>
          <p className="text-foreground font-medium mb-1">1. Open a demo account</p>
          <p>
            In MetaTrader 5, choose File then Open an Account, pick your broker and select{" "}
            <span className="text-foreground">demo</span>. Note the login and server.
          </p>
        </div>

        <div>
          <p className="text-foreground font-medium mb-1 flex items-center gap-1.5">
            <Monitor className="h-3.5 w-3.5" /> 2. You need a Windows machine
          </p>
          <p className="flex gap-2">
            <Apple className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              MetaTrader 5 has no web connection, so orders can only be placed by a small
              helper program running beside a logged-in terminal — and that helper only runs
              on Windows. On a Mac, use a rented Windows VPS from a trading-VPS provider
              (roughly 10–25 USD a month, always on), or run Windows in Parallels or VMware
              while your Mac is awake, or use any spare Windows PC.
            </span>
          </p>
        </div>

        <div>
          <p className="text-foreground font-medium mb-1">
            3. Install Python 3.10+ and the helper
          </p>
          <p>
            On that Windows machine, install Python, then copy the{" "}
            <span className="font-mono text-foreground">bridge</span> folder from this
            project (<span className="font-mono">ripple_bridge_helper.py</span>) onto it.
          </p>
        </div>

        <div>
          <p className="text-foreground font-medium mb-1">4. Run it</p>
          <p className="mb-2">
            Open Command Prompt in that folder and run the following, replacing the key with
            the bridge key you saved:
          </p>
          <CopyBlock text={commands} />
          <p className="mt-2">
            Leave the window open. It prints the account it attached to, then every order it
            places. This page ticks over to your live account summary within a minute.
          </p>
        </div>

        <div>
          <p className="text-foreground font-medium mb-1">5. Upload your broker's symbols</p>
          <p>
            Most brokers name shares differently (for example{" "}
            <span className="font-mono">AAPL.US</span>). Export the list from MetaTrader and
            upload it on{" "}
            <Link to="/admin/broker-symbols" className="text-primary hover:underline">
              broker symbol mapping
            </Link>{" "}
            so orders match the right instrument.
          </p>
        </div>
      </div>
    </section>
  );
}
