// Bridge endpoint: the MetaTrader 5 *demo* helper claims queued orders here.
// Secured with the owner's bridge secret (see bridge-auth.server).
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/bridge/orders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { authorizeBridge } = await import("@/lib/bridge-auth.server");
        const auth = await authorizeBridge(request);
        if (auth instanceof Response) return auth;
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
            await recordHeartbeat(auth.ownerId, body.heartbeat as never);
          }

          const queued = await syncBrokerOrders(auth.ownerId);
          const orders = await claimOrders(auth.ownerId, body.limit ?? 10);
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
