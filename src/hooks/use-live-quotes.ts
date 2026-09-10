import { useEffect, useMemo, useSyncExternalStore } from "react";
import { getQuotes } from "@/lib/quotes.functions";
import { markDataRefresh } from "@/lib/data-refresh-store";

export interface LiveQuote {
  price: number;
  change: number;
  changePct: number;
  prevClose: number;
  currency: string | null;
  at: string;
}

export type LiveStatus =
  | "ok"
  | "no_key"
  | "rate_limited"
  | "unsupported_symbol"
  | "network_error";

interface StreamQuote {
  price: number;
  change: number;
  changePct: number;
  prevClose: number;
  currency: string | null;
  at: string;
}

export interface FeedDiagnostics {
  provider: string;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
  attempts: number;
  successes: number;
  failures: number;
  cachedSymbols: number;
}

interface FeedSnapshot {
  quotes: Record<string, LiveQuote>;
  status: LiveStatus;
  marketOpen: boolean | null;
  streaming: boolean;
  updatedAt: number | null;
  diagnostics: FeedDiagnostics | null;
  loaded: boolean;
}

/** How many symbols the SSE route accepts per connection. */
const STREAM_LIMIT = 25;
/** How many symbols one REST snapshot call accepts. */
const SNAPSHOT_CHUNK = 60;
/** Hard ceiling so a huge page cannot fan out into endless snapshot calls. */
const SNAPSHOT_LIMIT = 180;
const SNAPSHOT_INTERVAL_MS = 60_000;
const RESYNC_DEBOUNCE_MS = 300;

const EMPTY_SNAPSHOT: FeedSnapshot = {
  quotes: {},
  status: "ok",
  marketOpen: null,
  streaming: false,
  updatedAt: null,
  diagnostics: null,
  loaded: false,
};

/**
 * One shared price feed for the whole app.
 *
 * Every panel used to open its own EventSource, which meant a busy page held
 * 100+ permanently-open connections and exhausted the browser's per-origin
 * connection pool — route chunks and server-function calls then queued behind
 * them forever, so navigation appeared to hang. All subscribers now share a
 * single stream plus a single REST snapshot poll.
 */
const store = (() => {
  const counts = new Map<string, number>();
  const listeners = new Set<() => void>();
  const prevClose: Record<string, number> = {};

  let snapshot: FeedSnapshot = EMPTY_SNAPSHOT;
  let es: EventSource | null = null;
  let streamKey = "";
  let resyncTimer: ReturnType<typeof setTimeout> | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let reopenTimer: ReturnType<typeof setTimeout> | null = null;
  let failures = 0;
  let fetching = false;

  const emit = () => {
    for (const l of [...listeners]) l();
  };

  const patch = (next: Partial<FeedSnapshot>) => {
    snapshot = { ...snapshot, ...next };
    emit();
  };

  const stamp = () => {
    const ts = Date.now();
    markDataRefresh(ts);
    return ts;
  };

  const symbols = () => [...counts.keys()].sort();

  const mergeQuotes = (incoming: Record<string, StreamQuote | null>) => {
    const quotes = { ...snapshot.quotes };
    let changed = false;
    for (const [t, q] of Object.entries(incoming)) {
      if (!q) continue;
      prevClose[t] = q.prevClose || q.price;
      quotes[t] = { ...q, currency: q.currency ?? quotes[t]?.currency ?? null };
      changed = true;
    }
    if (!changed) {
      patch({ loaded: true });
      return;
    }
    patch({ quotes, updatedAt: stamp(), loaded: true });
  };

  const applyTrades = (trades: Record<string, { price: number; at: string }>) => {
    const quotes = { ...snapshot.quotes };
    for (const [t, tr] of Object.entries(trades)) {
      const base = prevClose[t] ?? quotes[t]?.prevClose ?? tr.price;
      const change = tr.price - base;
      quotes[t] = {
        price: tr.price,
        change,
        changePct: base ? (change / base) * 100 : 0,
        prevClose: base,
        currency: quotes[t]?.currency ?? null,
        at: tr.at,
      };
    }
    patch({ quotes, updatedAt: stamp(), loaded: true });
  };

  const closeStream = () => {
    if (reopenTimer) {
      clearTimeout(reopenTimer);
      reopenTimer = null;
    }
    if (es) {
      es.close();
      es = null;
    }
    streamKey = "";
    if (snapshot.streaming) patch({ streaming: false });
  };

  const openStream = (list: string[]) => {
    const key = list.join(",");
    if (key === streamKey && es && es.readyState !== 2) return;
    closeStream();
    if (list.length === 0) return;
    streamKey = key;
    const source = new EventSource(
      `/api/public/stream/quotes?symbols=${encodeURIComponent(key)}`,
    );
    es = source;

    source.addEventListener("snapshot", (e) => {
      try {
        const payload = JSON.parse((e as MessageEvent).data) as {
          quotes: Record<string, StreamQuote | null>;
        };
        failures = 0;
        mergeQuotes(payload.quotes);
      } catch {
        /* ignore malformed frame */
      }
    });

    source.addEventListener("trade", (e) => {
      try {
        const payload = JSON.parse((e as MessageEvent).data) as {
          trades: Record<string, { price: number; at: string }>;
        };
        applyTrades(payload.trades);
      } catch {
        /* ignore malformed frame */
      }
    });

    source.addEventListener("status", (e) => {
      try {
        const s = JSON.parse((e as MessageEvent).data) as {
          streaming?: boolean;
          marketOpen?: boolean;
          status?: LiveStatus;
          diagnostics?: FeedDiagnostics;
        };
        patch({
          streaming: Boolean(s.streaming),
          ...(typeof s.marketOpen === "boolean" ? { marketOpen: s.marketOpen } : {}),
          ...(s.status ? { status: s.status } : {}),
          ...(s.diagnostics ? { diagnostics: s.diagnostics } : {}),
        });
      } catch {
        /* ignore malformed frame */
      }
    });

    // The route ends the stream after a few minutes; reopen with backoff
    // instead of leaving a dead connection behind.
    source.onerror = () => {
      patch({ streaming: false });
      if (source !== es) return;
      source.close();
      es = null;
      streamKey = "";
      if (counts.size === 0) return;
      failures = Math.min(failures + 1, 5);
      const delay = Math.min(1_000 * 2 ** (failures - 1), 30_000);
      if (reopenTimer) clearTimeout(reopenTimer);
      reopenTimer = setTimeout(() => {
        reopenTimer = null;
        if (counts.size > 0) openStream(symbols().slice(0, STREAM_LIMIT));
      }, delay);
    };
  };

  const fetchSnapshot = async () => {
    const list = symbols().slice(0, SNAPSHOT_LIMIT);
    if (list.length === 0 || fetching) return;
    fetching = true;
    try {
      const chunks: string[][] = [];
      for (let i = 0; i < list.length; i += SNAPSHOT_CHUNK) {
        chunks.push(list.slice(i, i + SNAPSHOT_CHUNK));
      }
      const results = await Promise.all(
        chunks.map((tickers) => getQuotes({ data: { tickers } })),
      );
      const merged: Record<string, StreamQuote | null> = {};
      let status: LiveStatus | null = null;
      let marketOpen: boolean | null = null;
      for (const r of results) {
        for (const [t, q] of Object.entries(r.quotes ?? {})) {
          if (!q) continue;
          merged[t] = {
            price: q.price,
            change: q.change,
            changePct: q.changePct,
            prevClose: q.prevClose,
            currency: q.currency ?? null,
            at: q.at,
          };
        }
        if (r.status && r.status !== "ok") status = r.status as LiveStatus;
        if (typeof r.marketOpen === "boolean") marketOpen = r.marketOpen;
      }
      if (status) patch({ status });
      if (marketOpen != null && snapshot.marketOpen == null) patch({ marketOpen });
      mergeQuotes(merged);
    } catch {
      patch({ loaded: true });
    } finally {
      fetching = false;
    }
  };

  const resync = () => {
    if (typeof window === "undefined") return;
    if (counts.size === 0) {
      closeStream();
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      return;
    }
    openStream(symbols().slice(0, STREAM_LIMIT));
    void fetchSnapshot();
    if (!pollTimer) {
      pollTimer = setInterval(() => void fetchSnapshot(), SNAPSHOT_INTERVAL_MS);
    }
  };

  const scheduleResync = () => {
    if (resyncTimer) clearTimeout(resyncTimer);
    resyncTimer = setTimeout(() => {
      resyncTimer = null;
      resync();
    }, RESYNC_DEBOUNCE_MS);
  };

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    getServerSnapshot: () => EMPTY_SNAPSHOT,
    /** Register interest in a symbol set; returns the release function. */
    register(list: string[]) {
      if (list.length === 0) return () => {};
      let dirty = false;
      for (const t of list) {
        const n = counts.get(t) ?? 0;
        if (n === 0) dirty = true;
        counts.set(t, n + 1);
      }
      if (dirty) scheduleResync();
      return () => {
        let released = false;
        for (const t of list) {
          const n = counts.get(t) ?? 0;
          if (n <= 1) {
            counts.delete(t);
            released = true;
          } else {
            counts.set(t, n - 1);
          }
        }
        if (released) scheduleResync();
      };
    },
  };
})();

/**
 * Live prices for a set of tickers, served from the shared app-wide feed:
 * a REST snapshot baseline plus streamed trades for the most-watched symbols.
 */
export function useLiveQuotes(tickers: string[]) {
  const joined = [...new Set(tickers.map((t) => t.toUpperCase()))].sort().join(",");
  const key = useMemo(() => (joined ? joined.split(",") : []), [joined]);

  useEffect(() => store.register(key), [key]);

  const feed = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );

  const quotes = useMemo(() => {
    const out: Record<string, LiveQuote> = {};
    for (const t of key) {
      const q = feed.quotes[t];
      if (q) out[t] = q;
    }
    return out;
  }, [feed.quotes, key]);

  return {
    quotes,
    isLoading: key.length > 0 && !feed.loaded && Object.keys(quotes).length === 0,
    status: feed.status,
    marketOpen: feed.marketOpen ?? false,
    streaming: feed.streaming,
    updatedAt: feed.updatedAt,
    diagnostics: feed.diagnostics,
  };
}

export function statusLabel(
  status: LiveStatus,
  opts: { streaming: boolean; marketOpen: boolean; updatedAt: number | null },
): string {
  if (status === "no_key") return "Price feed not configured";
  if (status === "rate_limited") return "Feed rate limited — retrying";
  if (status === "network_error") return "Feed unreachable — retrying";
  const mode = opts.streaming
    ? "Live · streaming"
    : opts.marketOpen
      ? "Delayed · refreshing"
      : "Delayed · market closed";
  return opts.updatedAt
    ? `${mode} · updated ${new Date(opts.updatedAt).toLocaleTimeString()}`
    : mode;
}
