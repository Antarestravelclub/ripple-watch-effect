// Shared bridge-secret check for every /api/public/bridge/* endpoint.
export function authorizeBridge(request: Request): Response | null {
  const expected = process.env["BRIDGE_SECRET"] ?? "";
  if (!expected) {
    return Response.json(
      { ok: false, error: "Bridge is not configured yet (BRIDGE_SECRET missing)." },
      { status: 503 },
    );
  }
  const provided = request.headers.get("x-bridge-key");
  if (provided !== expected) {
    console.error(
      `Bridge request rejected: ${provided ? "wrong" : "missing"} x-bridge-key on ${new URL(request.url).pathname}`,
    );
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
