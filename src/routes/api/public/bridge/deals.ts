// Bridge endpoint: the helper posts recent closed deals here (insert-if-new).
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/bridge/deals")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { authorizeBridge } = await import("@/lib/bridge-auth.server");
        const auth = await authorizeBridge(request);
        if (auth instanceof Response) return auth;
        try {
          const body = (await request.json().catch(() => ({}))) as { deals?: unknown };
          const { syncDeals } = await import("@/lib/bridge-sync.server");
          const result = await syncDeals(
            auth.ownerId,
            Array.isArray(body) ? body : (body.deals ?? []),
          );
          return Response.json({ ok: true, ...result });
        } catch (e) {
          return Response.json(
            { ok: false, error: e instanceof Error ? e.message : "Deals rejected" },
            { status: 400 },
          );
        }
      },
    },
  },
});
