import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { SiteShell } from "@/components/site-shell";
import {
  amIAdmin,
  makeMeAdmin,
  uploadBrokerSymbols,
  listBrokerSymbolUploads,
  getBrokerSymbols,
  updateBrokerSymbolMapping,
} from "@/lib/broker-symbols.functions";
import { ShieldCheck, Upload, AlertCircle, Search, Save } from "lucide-react";

export const Route = createFileRoute("/admin/broker-symbols")({
  head: () => ({
    meta: [
      { title: "Broker Symbol Mapping — The Ripple Effect" },
      {
        name: "description",
        content: "Admin tool for uploading and mapping broker symbols to app tickers.",
      },
      { property: "og:title", content: "Broker Symbol Mapping — The Ripple Effect" },
      {
        property: "og:description",
        content: "Upload DumpSymbols CSV and map broker symbols to app tickers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BrokerSymbolsAdminPage,
});

function ago(iso: string | null | undefined) {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  return h < 48 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

function BrokerSymbolsAdminPage() {
  const queryClient = useQueryClient();
  const checkAdmin = useServerFn(amIAdmin);
  const promote = useServerFn(makeMeAdmin);
  const upload = useServerFn(uploadBrokerSymbols);
  const listUploads = useServerFn(listBrokerSymbolUploads);
  const listSymbols = useServerFn(getBrokerSymbols);
  const updateSymbol = useServerFn(updateBrokerSymbolMapping);

  const { data: adminData, isLoading: adminLoading } = useQuery({
    queryKey: ["am-i-admin"],
    queryFn: () => checkAdmin(),
  });

  const { data: uploads, isLoading: uploadsLoading } = useQuery({
    queryKey: ["broker-symbol-uploads"],
    queryFn: () => listUploads(),
    enabled: adminData?.admin,
  });

  const [selectedUpload, setSelectedUpload] = useState<string | "latest">("latest");
  const [statusFilter, setStatusFilter] = useState<string>("unmapped");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 25;

  const { data: symbolsData, isLoading: symbolsLoading } = useQuery({
    queryKey: ["broker-symbols", selectedUpload, statusFilter, search, page],
    queryFn: () =>
      listSymbols({
        data: {
          uploadId: selectedUpload === "latest" ? undefined : selectedUpload,
          status: statusFilter || undefined,
          search: search || undefined,
          limit: pageSize,
          offset: page * pageSize,
        },
      }),
    enabled: adminData?.admin,
  });

  const promoteMutation = useMutation({
    mutationFn: () => promote(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["am-i-admin"] }),
  });

  const uploadMutation = useMutation({
    mutationFn: (csv: string) => upload({ data: { filename: "XM_symbols.csv", csv } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["broker-symbol-uploads"] });
      queryClient.invalidateQueries({ queryKey: ["broker-symbols"] });
      setPage(0);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; mappedAppTicker: string | null; mappingStatus: "manual_mapped" | "ignored" | "unmapped" }) =>
      updateSymbol({ data: payload }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["broker-symbols"] }),
  });

  const [manualValues, setManualValues] = useState<Record<string, string>>({});

  if (adminLoading) {
    return (
      <SiteShell>
        <div className="max-w-5xl">
          <h1 className="text-2xl font-semibold tracking-tight">Broker Symbol Mapping</h1>
          <p className="text-sm text-muted-foreground mt-2">Checking admin access…</p>
        </div>
      </SiteShell>
    );
  }

  if (!adminData?.admin) {
    return (
      <SiteShell>
        <div className="max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-tight">Broker Symbol Mapping</h1>
          <p className="text-sm text-muted-foreground mt-2 mb-4">
            This page is restricted to admins because it controls how app tickers are mapped to
            broker symbols.
          </p>
          <button
            onClick={() => promoteMutation.mutate()}
            disabled={promoteMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <ShieldCheck className="h-4 w-4" />
            {promoteMutation.isPending ? "Promoting…" : "Make me admin"}
          </button>
          {promoteMutation.isSuccess && (
            <p className="mt-3 text-sm text-tailwind">You are now an admin. Refresh the page.</p>
          )}
          {promoteMutation.isError && (
            <p className="mt-3 text-sm text-headwind">
              {promoteMutation.error instanceof Error ? promoteMutation.error.message : "Failed"}
            </p>
          )}
        </div>
      </SiteShell>
    );
  }

  const latestUpload = uploads?.[0];
  const uploadOptions = uploads?.map((u) => ({ value: u.id, label: `${u.filename ?? "upload"} · ${ago(u.created_at)} · ${u.symbol_count} symbols` })) ?? [];

  return (
    <SiteShell>
      <div className="max-w-5xl space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Broker Symbol Mapping</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload the CSV from the DumpSymbols MT5 script, review auto-mappings, and fix
            unmapped symbols. The bridge helper will use the mapped broker symbol first and fall
            back to suffix guessing only when no mapping exists.
          </p>
        </div>

        {/* Upload */}
        <section className="rounded-xl border border-border/70 bg-card/60 p-4">
          <h2 className="text-sm font-semibold tracking-tight flex items-center gap-2 mb-3">
            <Upload className="h-4 w-4 text-primary" />
            Upload broker symbol dump
          </h2>
          <textarea
            rows={6}
            placeholder="Paste the contents of XM_symbols.csv here…"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
            onChange={(e) => {
              const csv = e.target.value;
              if (csv.trim()) uploadMutation.mutate(csv);
            }}
            disabled={uploadMutation.isPending}
          />
          {uploadMutation.isPending && (
            <p className="mt-2 text-xs text-muted-foreground">Uploading and normalizing…</p>
          )}
          {uploadMutation.isSuccess && (
            <p className="mt-2 text-xs text-tailwind">
              Uploaded {uploadMutation.data.total} symbols · {uploadMutation.data.mapped} auto-mapped ·{" "}
              {uploadMutation.data.unmapped} unmapped.
            </p>
          )}
          {uploadMutation.isError && (
            <p className="mt-2 text-xs text-headwind">
              {uploadMutation.error instanceof Error ? uploadMutation.error.message : "Upload failed"}
            </p>
          )}
        </section>

        {/* Upload history */}
        <section className="rounded-xl border border-border/70 bg-card/60 p-4">
          <h2 className="text-sm font-semibold tracking-tight mb-3">Upload history</h2>
          {uploadsLoading ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : (uploads?.length ?? 0) === 0 ? (
            <p className="text-xs text-muted-foreground">No uploads yet.</p>
          ) : (
            <div className="space-y-2">
              {uploads!.map((u) => (
                <div
                  key={u.id}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs ${
                    latestUpload?.id === u.id ? "border-tailwind/40 bg-tailwind/5" : "border-border/60"
                  }`}
                >
                  <span className="font-medium">{u.filename ?? "upload"}</span>
                  <span className="text-muted-foreground">{ago(u.created_at)}</span>
                  <span className="font-mono tabular-nums">
                    {u.symbol_count} total · {u.mapped_count} mapped · {u.unmapped_count} unmapped
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Filters */}
        <section className="rounded-xl border border-border/70 bg-card/60 p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Upload</label>
              <select
                value={selectedUpload}
                onChange={(e) => {
                  setSelectedUpload(e.target.value);
                  setPage(0);
                }}
                className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
              >
                <option value="latest">Latest upload</option>
                {uploadOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(0);
                }}
                className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
              >
                <option value="unmapped">Unmapped</option>
                <option value="auto_mapped">Auto-mapped</option>
                <option value="manual_mapped">Manual-mapped</option>
                <option value="ignored">Ignored</option>
                <option value="">All</option>
              </select>
            </div>
            <div className="flex-[2]">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Search</label>
              <div className="relative mt-1">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(0);
                  }}
                  placeholder="symbol, description, base…"
                  className="w-full rounded-lg border border-border bg-background pl-7 pr-2 py-1.5 text-xs"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Symbols table */}
        <section>
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="text-sm font-semibold tracking-tight">Symbols</h2>
            <span className="text-[11px] text-muted-foreground">
              {symbolsData?.count ?? 0} total
            </span>
          </div>
          {symbolsLoading ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : (symbolsData?.rows?.length ?? 0) === 0 ? (
            <div className="rounded-xl border border-border/70 bg-card/60 p-4 flex gap-2 text-xs text-muted-foreground">
              <AlertCircle className="h-4 w-4 text-headwind shrink-0 mt-0.5" />
              <span>No symbols match these filters.</span>
            </div>
          ) : (
            <div className="rounded-xl border border-border/70 bg-card/40 overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground uppercase tracking-wider text-[10px]">
                  <tr className="border-b border-border/60">
                    <th className="text-left p-2">Broker symbol</th>
                    <th className="text-left p-2">Normalized</th>
                    <th className="text-left p-2">Description / Path</th>
                    <th className="text-left p-2">Trade mode</th>
                    <th className="text-left p-2">App ticker</th>
                    <th className="text-left p-2">Status</th>
                    <th className="text-left p-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {symbolsData!.rows.map((s) => (
                    <tr key={s.id} className="border-b border-border/40 last:border-b-0">
                      <td className="p-2 font-mono">{s.broker_symbol}</td>
                      <td className="p-2 font-mono text-muted-foreground">{s.normalized_base}</td>
                      <td className="p-2 max-w-[240px] truncate" title={s.description ?? undefined}>
                        {s.description}
                        {s.path && <div className="text-[10px] text-muted-foreground">{s.path}</div>}
                      </td>
                      <td className="p-2">{s.trade_mode}</td>
                      <td className="p-2">
                        {s.mapping_status === "auto_mapped" || s.mapping_status === "manual_mapped" ? (
                          <span className="font-mono text-tailwind">{s.mapped_app_ticker}</span>
                        ) : (
                          <input
                            type="text"
                            value={manualValues[s.id] ?? s.mapped_app_ticker ?? ""}
                            onChange={(e) =>
                              setManualValues((prev) => ({ ...prev, [s.id]: e.target.value.toUpperCase() }))
                            }
                            placeholder="AAPL"
                            className="w-24 rounded border border-border bg-background px-1.5 py-1 text-xs font-mono"
                          />
                        )}
                      </td>
                      <td className="p-2">
                        <span
                          className={
                            "inline-block rounded border px-1.5 py-0.5 text-[10px] " +
                            (s.mapping_status === "auto_mapped"
                              ? "text-tailwind border-tailwind/40"
                              : s.mapping_status === "manual_mapped"
                                ? "text-primary border-primary/40"
                                : s.mapping_status === "ignored"
                                  ? "text-muted-foreground border-border"
                                  : "text-headwind border-headwind/40")
                          }
                        >
                          {s.mapping_status}
                        </span>
                      </td>
                      <td className="p-2">
                        {s.mapping_status !== "auto_mapped" && (
                          <button
                            onClick={() =>
                              updateMutation.mutate({
                                id: s.id,
                                mappedAppTicker: manualValues[s.id]?.trim() || null,
                                mappingStatus: manualValues[s.id]?.trim() ? "manual_mapped" : "ignored",
                              })
                            }
                            disabled={updateMutation.isPending}
                            className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[10px] hover:bg-primary/10 disabled:opacity-50"
                          >
                            <Save className="h-3 w-3" />
                            {manualValues[s.id]?.trim() ? "Map" : "Ignore"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {(symbolsData?.count ?? 0) > pageSize && (
            <div className="flex items-center justify-between mt-3 text-xs">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="rounded border border-border px-3 py-1 disabled:opacity-50 hover:bg-primary/10"
              >
                Previous
              </button>
              <span className="text-muted-foreground">
                Page {page + 1} of {Math.max(1, Math.ceil((symbolsData?.count ?? 0) / pageSize))}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={(page + 1) * pageSize >= (symbolsData?.count ?? 0)}
                className="rounded border border-border px-3 py-1 disabled:opacity-50 hover:bg-primary/10"
              >
                Next
              </button>
            </div>
          )}
        </section>

        <p className="text-[11px] text-muted-foreground">
          <Link to="/broker" className="text-primary hover:underline">
            Back to Broker monitor
          </Link>
        </p>
      </div>
    </SiteShell>
  );
}
