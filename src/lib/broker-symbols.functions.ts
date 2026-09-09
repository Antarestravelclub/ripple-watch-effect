import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const KNOWN_SUFFIXES = [".US", ".cash", "-CFD", ".m", ".r", ".cash"];

function normalizeBase(symbol: string): string {
  let base = symbol.trim().toUpperCase();
  for (const suffix of KNOWN_SUFFIXES) {
    if (base.endsWith(suffix.toUpperCase())) {
      base = base.slice(0, -suffix.length);
      break;
    }
  }
  return base;
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim());
  if (lines.length === 0) return [];
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values: string[] = [];
    let inQuotes = false;
    let current = "";
    for (const ch of lines[i]) {
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    values.push(current.trim());
    const row: Record<string, string> = {};
    header.forEach((h, idx) => {
      row[h] = (values[idx] ?? "").replace(/^"|"$/g, "");
    });
    rows.push(row);
  }
  return rows;
}

const TRADE_MODE_PRIORITY: Record<string, number> = {
  full: 0,
  long_only: 1,
  short_only: 1,
  close_only: 2,
  disabled: 3,
  unknown: 4,
};

async function loadAppTickers(supabase: { from: (t: string) => unknown }) {
  const [signals, exposures] = await Promise.all([
    (supabase as never as { from: (t: string) => { select: (c: string) => Promise<{ data: { ticker: string }[] | null }> } }).from("signals").select("ticker"),
    (supabase as never as { from: (t: string) => { select: (c: string) => Promise<{ data: { ticker: string }[] | null }> } }).from("live_event_exposures").select("ticker"),
  ]);
  const set = new Set<string>();
  for (const row of signals.data ?? []) if (row.ticker) set.add(row.ticker.toUpperCase());
  for (const row of exposures.data ?? []) if (row.ticker) set.add(row.ticker.toUpperCase());
  return Array.from(set);
}

export const makeMeAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("user_roles")
      .insert({ user_id: context.userId, role: "admin" })
      .single();
    if (error?.message?.includes("duplicate")) {
      return { ok: true, already: true };
    }
    if (error) throw new Error(error.message);
    return { ok: true, already: false };
  });

export const amIAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (error) throw new Error(error.message);
    return { admin: Boolean(data) };
  });

export interface UploadBrokerSymbolsInput {
  filename?: string;
  csv: string;
}

export const uploadBrokerSymbols = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: UploadBrokerSymbolsInput) => {
    if (!data.csv || typeof data.csv !== "string") throw new Error("csv is required");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden: admin required");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const rows = parseCsv(data.csv);
    if (rows.length === 0) throw new Error("No rows found in CSV");

    const appTickers = await loadAppTickers(context.supabase);
    const tickerSet = new Set(appTickers);

    const { data: upload, error: uploadErr } = await supabaseAdmin
      .from("broker_symbol_uploads")
      .insert({
        filename: data.filename ?? "upload.csv",
        source: "DumpSymbols.mq5",
        symbol_count: rows.length,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (uploadErr || !upload) throw new Error(uploadErr?.message ?? "upload insert failed");

    const candidates: Record<string, { row: Record<string, string>; normalized: string }[]> = {};
    for (const row of rows) {
      const sym = row.symbol ?? row["symbol"] ?? "";
      if (!sym) continue;
      const normalized = normalizeBase(sym);
      if (!candidates[normalized]) candidates[normalized] = [];
      candidates[normalized].push({ row, normalized });
    }

    const symbolRows: Record<string, unknown>[] = [];
    let mapped = 0;
    let unmapped = 0;

    for (const [normalized, list] of Object.entries(candidates)) {
      const sorted = list.sort(
        (a, b) =>
          (TRADE_MODE_PRIORITY[a.row.trade_mode ?? "unknown"] ?? 99) -
          (TRADE_MODE_PRIORITY[b.row.trade_mode ?? "unknown"] ?? 99),
      );
      const best = sorted[0];
      const appTicker = tickerSet.has(normalized) ? normalized : null;
      const status = appTicker ? "auto_mapped" : "unmapped";
      if (appTicker) mapped++;
      else unmapped++;

      symbolRows.push({
        upload_id: upload.id,
        broker_symbol: best.row.symbol ?? best.row["symbol"] ?? normalized,
        description: best.row.description ?? best.row["description"] ?? null,
        path: best.row.path ?? best.row["path"] ?? null,
        currency_profit: best.row.currency_profit ?? best.row["currency_profit"] ?? null,
        trade_mode: best.row.trade_mode ?? best.row["trade_mode"] ?? null,
        normalized_base: normalized,
        mapped_app_ticker: appTicker,
        mapping_status: status,
      });
    }

    if (symbolRows.length > 0) {
      const { error: insErr } = await supabaseAdmin.from("broker_symbols").insert(symbolRows as never);
      if (insErr) throw new Error(insErr.message);
    }

    await supabaseAdmin
      .from("broker_symbol_uploads")
      .update({ mapped_count: mapped, unmapped_count: unmapped })
      .eq("id", upload.id);

    return { ok: true, uploadId: upload.id, total: symbolRows.length, mapped, unmapped };
  });

export const listBrokerSymbolUploads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden: admin required");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("broker_symbol_uploads")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export interface BrokerSymbolFilter {
  uploadId?: string;
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export const getBrokerSymbols = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: BrokerSymbolFilter) => data)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden: admin required");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let q = supabaseAdmin.from("broker_symbols").select("*", { count: "exact" });
    if (data.uploadId) q = q.eq("upload_id", data.uploadId);
    if (data.status) q = q.eq("mapping_status", data.status);
    if (data.search) {
      const term = data.search.trim().toUpperCase();
      q = q.or(`broker_symbol.ilike.%${term}%,description.ilike.%${term}%,normalized_base.ilike.%${term}%`);
    }
    q = q.order("mapping_status", { ascending: false }).order("broker_symbol");
    const limit = Math.min(Math.max(data.limit ?? 100, 1), 200);
    const offset = Math.max(data.offset ?? 0, 0);
    q = q.range(offset, offset + limit - 1);

    const { data: rows, error, count } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], count: count ?? 0 };
  });

export interface UpdateBrokerSymbolInput {
  id: string;
  mappedAppTicker?: string | null;
  mappingStatus: "manual_mapped" | "ignored" | "unmapped";
}

export const updateBrokerSymbolMapping = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: UpdateBrokerSymbolInput) => {
    if (!data.id) throw new Error("id is required");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden: admin required");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("broker_symbols")
      .update({
        mapped_app_ticker: data.mappedAppTicker ?? null,
        mapping_status: data.mappingStatus,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
