// Scheduled endpoint: evaluates every open signal against its target /
// invalidation levels and expires stale ones.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/evaluate-signals")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.CRON_SECRET ?? "";
        if (expected && request.headers.get("x-cron-key") !== expected) {
          return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        }
        try {
          const { runEvaluation } = await import("@/lib/signal-eval.server");
          const result = await runEvaluation();
          // Same cron, extra pass: automatic exits for open paper trades.
          let paper: unknown = null;
          try {
            const { runPaperTradeExits } = await import("@/lib/paper-trade-eval.server");
            paper = await runPaperTradeExits();
          } catch (e) {
            paper = { error: e instanceof Error ? e.message : "paper exits failed" };
          }

          // Mirror the resulting signal book into the demo order queue.
          let broker: unknown = null;
          try {
            const { syncBrokerOrders } = await import("@/lib/broker-queue.server");
            broker = await syncBrokerOrders();
          } catch (e) {
            broker = { error: e instanceof Error ? e.message : "queue sync failed" };
          }
          return Response.json({ ok: true, ...result, paper, broker });
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
