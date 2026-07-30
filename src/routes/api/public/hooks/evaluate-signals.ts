// Scheduled endpoint: evaluates every open signal against its target /
// invalidation levels and expires stale ones.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/evaluate-signals")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const { runEvaluation } = await import("@/lib/signal-eval.server");
          const result = await runEvaluation();
          return Response.json({ ok: true, ...result });
        } catch (e) {
          return Response.json(
            { ok: false, error: e instanceof Error ? e.message : "Evaluation failed" },
            { status: 500 },
          );
        }
      },
    },
  },
});
