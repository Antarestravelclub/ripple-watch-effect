import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getPaperAccount, updatePaperAccount } from "@/lib/paper-account.functions";
import { fmtMoney } from "@/lib/paper-trades";
import { Loader2, Wallet } from "lucide-react";

/**
 * The account's starting balance. Everything downstream — risk-based sizing,
 * P&L percentages, the equity curve and the Blotter stats — is computed from it.
 */
export function StartingBalanceCard() {
  const get = useServerFn(getPaperAccount);
  const save = useServerFn(updatePaperAccount);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["paper-account"],
    queryFn: () => get(),
  });

  const [balance, setBalance] = useState("");
  const [risk, setRisk] = useState("");
  const [minLot, setMinLot] = useState("");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!data) return;
    setBalance(String(data.startingBalance));
    setRisk(String(data.riskPerTradePct));
    setMinLot(String(data.defaultMinLot));
  }, [data]);

  const mut = useMutation({
    mutationFn: () =>
      save({
        data: {
          startingBalance: Number(balance),
          riskPerTradePct: Number(risk),
          defaultMinLot: Number(minLot),
        },
      }),
    onSuccess: () => {
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["paper-account"] });
      qc.invalidateQueries({ queryKey: ["paper-trades"] });
      qc.invalidateQueries({ queryKey: ["paper-prefill"] });
    },
  });

  return (
    <section className="rounded-xl border border-border/70 bg-card/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-primary" />
          <div>
            <h2 className="text-sm font-semibold">Starting balance</h2>
            <p className="text-xs text-muted-foreground">
              {isLoading
                ? "Loading…"
                : `${fmtMoney(data?.startingBalance ?? 0)} paper account${
                    data?.isDefault ? " (default)" : ""
                  } · risk ${data?.riskPerTradePct ?? 0}% per trade · minimum ${
                    data?.defaultMinLot ?? 1
                  } lot when the broker file doesn't say`}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="rounded-md border border-border/70 px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent"
        >
          {editing ? "Cancel" : "Change"}
        </button>
      </div>

      {editing && (
        <>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <NumField label="Starting balance ($)" value={balance} onChange={setBalance} />
            <NumField label="Risk per trade (%)" value={risk} onChange={setRisk} />
            <NumField label="Default minimum lot" value={minLot} onChange={setMinLot} />
          </div>
          {mut.error && (
            <p className="mt-2 text-xs text-headwind">
              {mut.error instanceof Error ? mut.error.message : "Could not save"}
            </p>
          )}
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              disabled={mut.isPending || !(Number(balance) > 0)}
              onClick={() => mut.mutate()}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-60"
            >
              {mut.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
              Save balance
            </button>
            <p className="text-[11px] text-muted-foreground">
              Sizing, percentages, equity curve and stats all recompute from this figure. Trades
              already open keep the lots you entered.
            </p>
          </div>
        </>
      )}
    </section>
  );
}

function NumField({
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
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-border/70 bg-background px-2 py-1.5 text-sm font-mono"
      />
    </div>
  );
}
