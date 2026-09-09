// Shared bridge-secret check for every /api/public/bridge/* endpoint.
//
// The helper may send the secret three ways (it sends more than one for
// compatibility): x-bridge-key, Authorization: Bearer <secret>, or
// X-Bridge-Secret. Every accepted secret resolves to exactly one signed-in
// owner; all bridge state written or claimed by the request is scoped to that
// owner. There is deliberately no workspace-wide fallback secret.
function presentedSecrets(request: Request): string[] {
  const out: string[] = [];
  const key = request.headers.get("x-bridge-key");
  if (key) out.push(key.trim());
  const legacy = request.headers.get("x-bridge-secret");
  if (legacy) out.push(legacy.trim());
  const auth = request.headers.get("authorization");
  if (auth && /^bearer\s+/i.test(auth)) out.push(auth.replace(/^bearer\s+/i, "").trim());
  return out.filter(Boolean);
}

export interface BridgeAuthorization {
  ownerId: string;
}

export async function authorizeBridge(
  request: Request,
): Promise<BridgeAuthorization | Response> {
  const provided = presentedSecrets(request);

  if (provided.length === 0) {
    console.error(`Bridge request rejected: no secret on ${new URL(request.url).pathname}`);
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { ownerOfBridgeSecret } = await import("./bridge-secret.server");
  for (const candidate of provided) {
    const ownerId = await ownerOfBridgeSecret(candidate);
    if (ownerId) return { ownerId };
  }

  console.error(`Bridge request rejected: unknown secret on ${new URL(request.url).pathname}`);
  return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}
