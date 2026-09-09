// Bridge endpoint: the helper posts the full current open-position list here.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/bridge/positions")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { authorizeBridge } = await import("@/lib/bridge-auth.server");
        const denied = await authorizeBridge(request);
        if (denied) return denied;
        try {
          const body = (await request.json().catch(() => ({}))) as {
            positions?: unknown;
          };
          const { syncPositions } = await import("@/lib/bridge-sync.server");
          const result = await syncPositions(
            Array.isArray(body) ? body : (body.positions ?? []),
          );
          return Response.json({ ok: true, ...result });
        } catch (e) {
          return Response.json(
            { ok: false, error: e instanceof Error ? e.message : "Positions rejected" },
            { status: 400 },
          );
        }
      },
    },
  },
});
