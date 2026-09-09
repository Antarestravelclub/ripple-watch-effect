// Bridge endpoint: the demo helper reports what happened to claimed orders.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const schema = z.object({
  reports: z
    .array(
      z.object({
        id: z.string().uuid(),
        status: z.enum(["filled", "rejected", "skipped"]),
        broker_symbol: z.string().max(64).nullish(),
        broker_ticket: z.string().max(64).nullish(),
        filled_price: z.number().finite().nullish(),
        filled_volume: z.number().finite().nullish(),
        error: z.string().max(500).nullish(),
      }),
    )
    .max(50),
});

export const Route = createFileRoute("/api/public/bridge/fills")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { authorizeBridge } = await import("@/lib/bridge-auth.server");
        const auth = await authorizeBridge(request);
        if (auth instanceof Response) return auth;
        try {
          const parsed = schema.parse(await request.json());
          const { recordFills } = await import("@/lib/broker-queue.server");
          const updated = await recordFills(auth.ownerId, parsed.reports);
          return Response.json({ ok: true, updated });
        } catch (e) {
          return Response.json(
            { ok: false, error: e instanceof Error ? e.message : "Invalid payload" },
            { status: 400 },
          );
        }
      },
    },
  },
});
