// Shared bridge-secret check for every /api/public/bridge/* endpoint.
//
// The helper may send the secret three ways (it sends more than one for
// compatibility): x-bridge-key, Authorization: Bearer <secret>, or
// X-Bridge-Secret. A secret is valid when it matches this owner's stored bridge
// secret, or the workspace-wide BRIDGE_SECRET when one is configured.
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

export async function authorizeBridge(request: Request): Promise<Response | null> {
  const provided = presentedSecrets(request);
  const envSecret = process.env["BRIDGE_SECRET"] ?? "";

  if (provided.length === 0) {
    console.error(`Bridge request rejected: no secret on ${new URL(request.url).pathname}`);
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (envSecret && provided.includes(envSecret)) return null;

  const { ownerOfBridgeSecret } = await import("./bridge-secret.server");
  for (const candidate of provided) {
    const owner = await ownerOfBridgeSecret(candidate);
    if (owner) return null;
  }

  console.error(`Bridge request rejected: unknown secret on ${new URL(request.url).pathname}`);
  return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}
