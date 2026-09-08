import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
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

/**
 * Live prices for a set of tickers: REST snapshot for the baseline, then a
 * server-sent stream that applies trades as they print. Falls back to polling
 * when the stream is unavailable or the market is closed.
 */
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

export function useLiveQuotes(tickers: string[]) {
  const key = useMemo(() => [...new Set(tickers.map((t) => t.toUpperCase()))].sort(), [
    tickers.join(","),
  ]);
  const fetchQuotes = useServerFn(getQuotes);
  const [live, setLive] = useState<Record<string, LiveQuote>>({});
  const [streaming, setStreaming] = useState(false);
  const [streamMarketOpen, setStreamMarketOpen] = useState<boolean | null>(null);
  const [streamStatus, setStreamStatus] = useState<LiveStatus | null>(null);
  const [streamDiag, setStreamDiag] = useState<FeedDiagnostics | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const prevCloseRef = useRef<Record<string, number>>({});


  const { data, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ["quotes", key.join(",")],
    queryFn: () => fetchQuotes({ data: { tickers: key } }),
    enabled: key.length > 0,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  // Seed / refresh from the REST snapshot.
  useEffect(() => {
    if (!data?.quotes) return;
    setLive((prev) => {
      const next = { ...prev };
      for (const [t, q] of Object.entries(data.quotes)) {
        if (!q) continue;
        prevCloseRef.current[t] = q.prevClose || q.price;
        next[t] = {
          price: q.price,
          change: q.change,
          changePct: q.changePct,
          prevClose: q.prevClose,
          currency: q.currency ?? null,
          at: q.at,
        };
      }
      return next;
    });
    const ts = Date.now();
    setUpdatedAt(ts);
    markDataRefresh(ts);
  }, [data]);

  // Subscribe to the stream.
  useEffect(() => {
    if (key.length === 0 || typeof window === "undefined") return;
    const es = new EventSource(
      `/api/public/stream/quotes?symbols=${encodeURIComponent(key.join(","))}`,
    );

    const applySnapshot = (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data) as {
          quotes: Record<string, StreamQuote | null>;
        };
        setLive((prev) => {
          const next = { ...prev };
          for (const [t, q] of Object.entries(payload.quotes)) {
            if (!q) continue;
            prevCloseRef.current[t] = q.prevClose || q.price;
            next[t] = { ...q, currency: q.currency ?? next[t]?.currency ?? null };
          }
          return next;
        });
        const ts = Date.now();
    setUpdatedAt(ts);
    markDataRefresh(ts);
      } catch {
        /* ignore */
      }
    };

    const applyTrade = (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data) as {
          trades: Record<string, { price: number; at: string }>;
        };
        setLive((prev) => {
          const next = { ...prev };
          for (const [t, tr] of Object.entries(payload.trades)) {
            const base = prevCloseRef.current[t] ?? next[t]?.prevClose ?? tr.price;
            const change = tr.price - base;
            next[t] = {
              price: tr.price,
              change,
              changePct: base ? (change / base) * 100 : 0,
              prevClose: base,
              currency: next[t]?.currency ?? null,
              at: tr.at,
            };
          }
          return next;
        });
        const ts = Date.now();
    setUpdatedAt(ts);
    markDataRefresh(ts);
      } catch {
        /* ignore */
      }
    };

    const onStatus = (e: MessageEvent) => {
      try {
        const s = JSON.parse(e.data) as {
          streaming?: boolean;
          marketOpen?: boolean;
          status?: LiveStatus;
          diagnostics?: FeedDiagnostics;
        };
        setStreaming(Boolean(s.streaming));
        if (typeof s.marketOpen === "boolean") setStreamMarketOpen(s.marketOpen);
        if (s.status) setStreamStatus(s.status);
        if (s.diagnostics) setStreamDiag(s.diagnostics);
      } catch {
        /* ignore */
      }
    };

    es.addEventListener("snapshot", applySnapshot as EventListener);
    es.addEventListener("trade", applyTrade as EventListener);
    es.addEventListener("status", onStatus as EventListener);
    es.onerror = () => setStreaming(false);

    return () => {
      es.close();
      setStreaming(false);
      setStreamMarketOpen(null);
    };
  }, [key.join(",")]);

  const restDiag: FeedDiagnostics | null = null;
  const diagnostics = useMemo(() => {
    if (!streamDiag) return restDiag;
    if (!restDiag) return streamDiag;
    const newer = (a: string | null, b: string | null) =>
      (a ?? "") >= (b ?? "") ? a : b;
    const streamWins =
      (streamDiag.lastAttemptAt ?? "") >= (restDiag.lastAttemptAt ?? "");
    return {
      ...(streamWins ? streamDiag : restDiag),
      lastSuccessAt: newer(streamDiag.lastSuccessAt, restDiag.lastSuccessAt),
      lastAttemptAt: newer(streamDiag.lastAttemptAt, restDiag.lastAttemptAt),
    } as FeedDiagnostics;
  }, [streamDiag, restDiag]);

  return {
    quotes: live,
    isLoading: isLoading && Object.keys(live).length === 0,
    status: (streamStatus ?? data?.status ?? "ok") as LiveStatus,
    // The stream evaluates market hours when it connects. Prefer that fresh
    // value over a potentially cached REST snapshot from SSR/query hydration.
    marketOpen: streamMarketOpen ?? data?.marketOpen ?? false,
    streaming,
    updatedAt: updatedAt ?? (dataUpdatedAt || null),
    diagnostics,
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
