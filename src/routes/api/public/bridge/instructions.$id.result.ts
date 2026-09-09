// Bridge endpoint: the demo helper reports a fill or rejection for one
// instruction. Idempotent — repeat posts for the same id change nothing.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/bridge/instructions/$id/result")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const { authorizeBridge } = await import("@/lib/bridge-auth.server");
        const denied = authorizeBridge(request);
        if (denied) return denied;
        try {
          const body = (await request.json().catch(() => ({}))) as {
            status?: string;
            fill_price?: number | string | null;
            fill_time?: string | null;
            ticket?: number | string | null;
            detail?: string | null;
            error?: string | null;
          };
          if (body.status !== "filled" && body.status !== "rejected") {
            return Response.json(
              { ok: false, error: "status must be 'filled' or 'rejected'." },
              { status: 400 },
            );
          }
          const num = (v: unknown) => {
            if (v === null || v === undefined || v === "") return null;
            const n = Number(v);
            return Number.isFinite(n) ? n : null;
          };
          const { recordInstructionResult } = await import("@/lib/bridge-mirror.server");
          const result = await recordInstructionResult(params.id, {
            status: body.status,
            fill_price: num(body.fill_price),
            fill_time: body.fill_time ?? null,
            ticket: num(body.ticket),
            detail: body.detail ?? body.error ?? null,
          });
          return Response.json({ ok: true, ...result });
        } catch (e) {
          return Response.json(
            { ok: false, error: e instanceof Error ? e.message : "Result rejected" },
            { status: 400 },
          );
        }
      },
    },
  },
});
