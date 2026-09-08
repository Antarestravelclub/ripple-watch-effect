import { createFileRoute } from "@tanstack/react-router";

/**
 * Server-sent price stream. The browser passes a symbol list; the API key
 * stays server-side. Uses the Finnhub trade socket when the runtime exposes a
 * WebSocket client, otherwise falls back to fast REST polling.
 */
export const Route = createFileRoute("/api/public/stream/quotes")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const apiKey = process.env.FINNHUB_API_KEY;
        const url = new URL(request.url);
        const symbols = (url.searchParams.get("symbols") ?? "")
          .split(",")
          .map((s) => s.trim().toUpperCase().slice(0, 16))
          .filter(Boolean)
          .slice(0, 25);

        const encoder = new TextEncoder();

        if (!apiKey || symbols.length === 0) {
          return new Response(
            encoder.encode(
              `event: status\ndata: ${JSON.stringify({
                status: apiKey ? "ok" : "no_key",
                streaming: false,
              })}\n\n`,
            ),
            { headers: sseHeaders() },
          );
        }

        const { fetchQuotesBatch, isUsMarketOpen, getFeedDiagnostics } = await import(
          "@/lib/quotes.server"
        );
        const MAX_MS = 4 * 60_000;
        const started = Date.now();

        const stream = new ReadableStream({
          async start(controller) {
            let closed = false;
            const send = (event: string, payload: unknown) => {
              if (closed) return;
              try {
                controller.enqueue(
                  encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`),
                );
              } catch {
                closed = true;
              }
            };

            const open = isUsMarketOpen();
            let socket: WebSocket | null = null;

            const snapshot = async () => {
              const { quotes, status } = await fetchQuotesBatch(symbols, apiKey);
              send("snapshot", { quotes, at: new Date().toISOString() });
              send("status", {
                status,
                streaming: Boolean(socket),
                marketOpen: open,
                diagnostics: getFeedDiagnostics(),
              });
            };

            await snapshot();


            if (open && typeof WebSocket !== "undefined") {
              try {
                socket = new WebSocket(`wss://ws.finnhub.io?token=${apiKey}`);
                socket.addEventListener("open", () => {
                  for (const s of symbols)
                    socket?.send(JSON.stringify({ type: "subscribe", symbol: s }));
                  send("status", { status: "ok", streaming: true, marketOpen: true });
                });
                socket.addEventListener("message", (ev: MessageEvent) => {
                  try {
                    const msg = JSON.parse(String(ev.data)) as {
                      type?: string;
                      data?: Array<{ s: string; p: number; t: number }>;
                    };
                    if (msg.type !== "trade" || !msg.data?.length) return;
                    const trades: Record<string, { price: number; at: string }> = {};
                    for (const t of msg.data)
                      trades[t.s] = { price: t.p, at: new Date(t.t).toISOString() };
                    send("trade", { trades });
                  } catch {
                    /* ignore malformed frames */
                  }
                });
                socket.addEventListener("error", () => {
                  send("status", { status: "ok", streaming: false, marketOpen: open });
                });
              } catch {
                socket = null;
              }
            }

            if (!socket) {
              send("status", {
                status: "ok",
                streaming: false,
                marketOpen: open,
                diagnostics: getFeedDiagnostics(),
              });
            }

            // Slower than the provider's per-minute allowance allows for bursts.
            const pollMs = socket ? 30_000 : open ? 25_000 : 60_000;

            const timer = setInterval(async () => {
              if (closed || Date.now() - started > MAX_MS) {
                clearInterval(timer);
                try {
                  socket?.close();
                } catch {
                  /* noop */
                }
                closed = true;
                try {
                  controller.close();
                } catch {
                  /* noop */
                }
                return;
              }
              await snapshot();
            }, pollMs);

            request.signal?.addEventListener("abort", () => {
              closed = true;
              clearInterval(timer);
              try {
                socket?.close();
              } catch {
                /* noop */
              }
              try {
                controller.close();
              } catch {
                /* noop */
              }
            });
          },
        });

        return new Response(stream, { headers: sseHeaders() });
      },
    },
  },
});

function sseHeaders() {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  };
}
