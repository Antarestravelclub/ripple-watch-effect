import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { SiteShell } from "@/components/site-shell";
import { supabase } from "@/integrations/supabase/client";
import {
  listEtfReference,
  setEtfActive,
  upsertEtfReference,
  verifyEtfFeeds,
} from "@/lib/etf-reference.functions";
import {
  ETF_CATEGORY_LABEL,
  ETF_EXCLUSION_NOTE,
  type EtfCategory,
} from "@/lib/instrument";

export const Route = createFileRoute("/admin/etfs")({
  head: () => ({
    meta: [
      { title: "ETF universe — The Ripple Effect" },
      {
        name: "description",
        content:
          "Maintain the fund universe the ripple engine can map events to: themes, categories and price-feed health.",
      },
      { property: "og:title", content: "ETF universe — The Ripple Effect" },
      {
        property: "og:description",
        content: "Admin maintenance for the exchange-traded fund reference list.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EtfAdminPage,
});

const CATEGORIES = Object.keys(ETF_CATEGORY_LABEL) as EtfCategory[];

function EtfAdminPage() {
  const listFn = useServerFn(listEtfReference);
  const upsertFn = useServerFn(upsertEtfReference);
  const activeFn = useServerFn(setEtfActive);
  const verifyFn = useServerFn(verifyEtfFeeds);
  const qc = useQueryClient();

  const { data: isAdmin } = useQuery({
    queryKey: ["am-i-admin"],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getUser();
      if (!session.user) return false;
      const { data } = await supabase.rpc("has_role", {
        _user_id: session.user.id,
        _role: "admin",
      });
      return data === true;
    },
  });

  const { data } = useQuery({
    queryKey: ["etf-reference"],
    queryFn: () => listFn(),
    staleTime: 60_000,
  });
  const rows = data?.rows ?? [];

  const [form, setForm] = useState({
    ticker: "",
    name: "",
    category: "sector" as EtfCategory,
    keywords: "",
  });

  const upsert = useMutation({
    mutationFn: () =>
      upsertFn({
        data: {
          ticker: form.ticker.trim().toUpperCase(),
          name: form.name.trim(),
          category: form.category,
          theme_keywords: form.keywords
            .split(",")
            .map((k) => k.trim())
            .filter((k) => k.length >= 2),
          leveraged: false,
          inverse: false,
          active: true,
        },
      }),
    onSuccess: () => {
      setForm({ ticker: "", name: "", category: "sector", keywords: "" });
      qc.invalidateQueries({ queryKey: ["etf-reference"] });
    },
  });

  const toggle = useMutation({
    mutationFn: (v: { ticker: string; active: boolean }) => activeFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["etf-reference"] }),
  });

  const verify = useMutation({
    mutationFn: () => verifyFn(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["etf-reference"] }),
  });

  if (isAdmin === false) {
    return (
      <SiteShell>
        <h1 className="text-2xl font-semibold tracking-tight">ETF universe</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This maintenance page is limited to administrators.
        </p>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <h1 className="text-2xl font-semibold tracking-tight">ETF universe</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Funds the ripple engine can map events to. Matching is keyword-based:
        an event whose text mentions a fund's themes becomes a candidate, then
        the usual conviction score, ATR stop and sizing decide the signal.
      </p>
      <p className="mt-2 max-w-2xl rounded-lg border border-border/70 bg-card/40 p-3 text-xs text-muted-foreground">
        {ETF_EXCLUSION_NOTE}
      </p>

      <div className="mt-5 flex flex-wrap items-end gap-2">
        <input
          value={form.ticker}
          onChange={(e) => setForm({ ...form, ticker: e.target.value })}
          placeholder="Ticker"
          className="w-24 rounded-md border border-border/70 bg-background px-2 py-1.5 text-sm"
        />
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Fund name"
          className="w-64 rounded-md border border-border/70 bg-background px-2 py-1.5 text-sm"
        />
        <select
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value as EtfCategory })}
          className="rounded-md border border-border/70 bg-background px-2 py-1.5 text-sm"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {ETF_CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
        <input
          value={form.keywords}
          onChange={(e) => setForm({ ...form, keywords: e.target.value })}
          placeholder="themes, comma separated"
          className="w-72 rounded-md border border-border/70 bg-background px-2 py-1.5 text-sm"
        />
        <button
          type="button"
          onClick={() => upsert.mutate()}
          disabled={upsert.isPending || !form.ticker || !form.name}
          className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
        >
          {upsert.isPending ? "Saving…" : "Save fund"}
        </button>
        <button
          type="button"
          onClick={() => verify.mutate()}
          disabled={verify.isPending}
          className="rounded-md border border-border/70 px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent disabled:opacity-50"
        >
          {verify.isPending ? "Checking feeds…" : "Check price feeds"}
        </button>
      </div>
      {upsert.error && (
        <p className="mt-2 text-xs text-headwind">
          {upsert.error instanceof Error ? upsert.error.message : "Could not save"}
        </p>
      )}
      {verify.data && (
        <p className="mt-2 text-xs text-muted-foreground">
          Checked {verify.data.checked} fund{verify.data.checked === 1 ? "" : "s"} —{" "}
          {verify.data.failed} with no usable price or history (switched off).
        </p>
      )}

      <div className="mt-5 overflow-x-auto rounded-xl border border-border/70">
        <table className="w-full text-xs">
          <thead className="bg-card/60 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="p-2 text-left">Ticker</th>
              <th className="p-2 text-left">Name</th>
              <th className="p-2 text-left">Category</th>
              <th className="p-2 text-left">Themes</th>
              <th className="p-2 text-left">State</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.ticker} className="border-t border-border/50">
                <td className="p-2 font-mono font-semibold">{r.ticker}</td>
                <td className="p-2">{r.name}</td>
                <td className="p-2 text-muted-foreground">
                  {ETF_CATEGORY_LABEL[r.category] ?? r.category}
                </td>
                <td className="max-w-[320px] p-2 text-muted-foreground">
                  {(r.theme_keywords ?? []).join(", ")}
                </td>
                <td className="p-2">
                  {r.leveraged || r.inverse ? (
                    <span className="text-amber">
                      {r.leveraged ? "Leveraged" : "Inverse"} — never suggested
                    </span>
                  ) : r.active ? (
                    <span className="text-tailwind">In universe</span>
                  ) : (
                    <span className="text-muted-foreground">
                      Off{r.feed_error ? ` — ${r.feed_error}` : ""}
                    </span>
                  )}
                </td>
                <td className="p-2 text-right">
                  {!r.leveraged && !r.inverse && (
                    <button
                      type="button"
                      onClick={() => toggle.mutate({ ticker: r.ticker, active: !r.active })}
                      className="rounded-md border border-border/70 px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-accent"
                    >
                      {r.active ? "Switch off" : "Switch on"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  No funds in the universe yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </SiteShell>
  );
}
