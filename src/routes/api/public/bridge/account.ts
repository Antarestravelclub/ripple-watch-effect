// Bridge endpoint: the MetaTrader 5 *demo* helper posts account snapshots here.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/bridge/account")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { authorizeBridge } = await import("@/lib/bridge-auth.server");
        const auth = await authorizeBridge(request);
        if (auth instanceof Response) return auth;
        try {
          const body = await request.json().catch(() => ({}));
          const { recordAccountSnapshot } = await import("@/lib/bridge-sync.server");
          const result = await recordAccountSnapshot(auth.ownerId, body);
          return Response.json({ ok: true, ...result });
        } catch (e) {
          return Response.json(
            { ok: false, error: e instanceof Error ? e.message : "Snapshot rejected" },
            { status: 400 },
          );
        }
      },
    },
  },
});
