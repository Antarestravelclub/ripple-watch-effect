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
  const commands = ["pip install MetaTrader5 requests", "python ripple_bridge_helper.py"].join("\n");

  return (
    <section className="rounded-xl border border-border/70 bg-card/60 p-4 mb-5">
      <h2 className="text-sm font-semibold tracking-tight mb-3">
        Connect your demo account
      </h2>

      <ol className="grid gap-1.5 text-xs mb-4">
        <Step done={configured} label="Your private bridge key has been created" />
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
          <p className="text-foreground font-medium mb-1">1. Use the Bridge setup page</p>
          <p>
            Open{" "}
            <Link to="/bridge" className="text-primary hover:underline">
              Bridge
            </Link>{" "}
            and download both prepared files: the helper program and the matching
            config file with your private key and account number already filled in.
            Nothing needs to be pasted into environment variables.
          </p>
        </div>

        <div>
          <p className="text-foreground font-medium mb-1 flex items-center gap-1.5">
            <Monitor className="h-3.5 w-3.5" /> 2. You need a Windows machine
          </p>
          <p className="flex gap-2">
            <Apple className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              MetaTrader 5 has no web connection, so the helper only runs beside a
              logged-in terminal on Windows. On a Mac, use a rented Windows trading
              VPS, Parallels or VMware while your Mac is awake, or a spare Windows PC.
            </span>
          </p>
        </div>

        <div>
          <p className="text-foreground font-medium mb-1">3. Install and run</p>
          <p className="mb-2">
            Put both downloaded files in one folder, open Command Prompt there, then run:
          </p>
          <CopyBlock text={commands} />
        </div>

        <div>
          <p className="text-foreground font-medium mb-1">4. Keep each account separate</p>
          <p>
            Your key only reports and claims your own bridge state. Regenerate it on the
            Bridge page if it is ever shared; the old key stops working immediately.
          </p>
        </div>
      </div>
    </section>
  );
}
