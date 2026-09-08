// Secured maintenance endpoint: fills missing index entry/exit prices so
// per-signal alpha can be computed for older signals.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/backfill-benchmarks")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.CRON_SECRET ?? "";
        if (expected && request.headers.get("x-cron-key") !== expected) {
          return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        }
        try {
          const { backfillBenchmarks } = await import("@/lib/benchmark-backfill.server");
          const result = await backfillBenchmarks();
          return Response.json({ ok: true, ...result });
        } catch (e) {
          return Response.json(
            { ok: false, error: e instanceof Error ? e.message : "Backfill failed" },
            { status: 500 },
          );
        }
      },
    },
  },
});
