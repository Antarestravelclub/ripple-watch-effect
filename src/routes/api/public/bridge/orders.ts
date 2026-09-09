// Bridge endpoint: the MetaTrader 5 *demo* helper claims queued orders here.
// Secured with the owner's bridge secret (see bridge-auth.server).
import { createFileRoute } from "@tanstack/react-router";


export const Route = createFileRoute("/api/public/bridge/orders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = authorize(request);
        if (denied) return denied;
        try {
          const body = (await request.json().catch(() => ({}))) as {
            limit?: number;
            heartbeat?: Record<string, unknown>;
          };
          const { claimOrders, recordHeartbeat, syncBrokerOrders } = await import(
            "@/lib/broker-queue.server"
          );

          if (body.heartbeat) {
            const hb = body.heartbeat as { account_is_demo?: boolean };
            if (hb.account_is_demo === false) {
              return Response.json(
                {
                  ok: false,
                  error:
                    "Refused: the reporting terminal is not a demo account. This app only trades demo accounts.",
                },
                { status: 403 },
              );
            }
            await recordHeartbeat(body.heartbeat as never);
          }

          const queued = await syncBrokerOrders();
          const orders = await claimOrders(body.limit ?? 10);
          return Response.json({ ok: true, mode: "demo", queued, orders });
        } catch (e) {
          return Response.json(
            { ok: false, error: e instanceof Error ? e.message : "Bridge poll failed" },
            { status: 500 },
          );
        }
      },
    },
  },
});
