// Scheduled endpoint: pulls the latest market news every 15 minutes, extracts
// equity exposure, validates tickers and stores events + auto-generated signals.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/ingest-news")({
  server: {
    handlers: {
      POST: async () => {
        const { runNewsIngest } = await import("@/lib/news-ingest.server");
        const result = await runNewsIngest();
        return new Response(JSON.stringify(result), {
          status: result.ok ? 200 : 500,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
