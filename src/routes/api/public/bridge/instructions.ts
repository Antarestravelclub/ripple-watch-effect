// Bridge endpoint: the demo helper polls pending mirror instructions here.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/bridge/instructions")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { authorizeBridge } = await import("@/lib/bridge-auth.server");
        const denied = authorizeBridge(request);
        if (denied) return denied;
        try {
          const url = new URL(request.url);
          if ((url.searchParams.get("status") ?? "pending") !== "pending") {
            return Response.json(
              { ok: false, error: "Only status=pending can be claimed." },
              { status: 400 },
            );
          }
          const limit = Number(url.searchParams.get("limit") ?? 10);
          const { claimInstructions } = await import("@/lib/bridge-mirror.server");
          const instructions = await claimInstructions(Number.isFinite(limit) ? limit : 10);
          return Response.json({ ok: true, mode: "demo", instructions });
        } catch (e) {
          return Response.json(
            { ok: false, error: e instanceof Error ? e.message : "Poll failed" },
            { status: 500 },
          );
        }
      },
    },
  },
});
