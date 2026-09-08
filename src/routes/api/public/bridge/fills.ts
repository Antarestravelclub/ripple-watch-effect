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
        const expected = process.env["BRIDGE_SECRET"] ?? "";
        if (!expected) {
          return Response.json(
            { ok: false, error: "Bridge is not configured yet (BRIDGE_SECRET missing)." },
            { status: 503 },
          );
        }
        if (request.headers.get("x-bridge-key") !== expected) {
          return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        }
        try {
          const parsed = schema.parse(await request.json());
          const { recordFills } = await import("@/lib/broker-queue.server");
          const updated = await recordFills(parsed.reports);
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
