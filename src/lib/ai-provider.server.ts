// Server-only AI provider module. Every AI call in the app goes through
// chatJSON() so the model vendor is swappable by environment variable and the
// app never silently falls back to a provider you did not choose.
//
// Selection order:
//   1. AI_PROVIDER env ("openai" | "gemini" | "lovable") if set
//   2. otherwise: openai if OPENAI_API_KEY is set,
//                 else gemini if GEMINI_API_KEY is set,
//                 else lovable if LOVABLE_API_KEY is set
//   3. otherwise: throw a terminal "[403]" error (circuit breaker stops the run)
//
// Error-message tokens are load-bearing: news-ingest's isTerminalAiError()
// treats "[402]", "[403]" and "credits exhausted" as terminal (stop the whole
// run); plain 429 rate limits are retryable. Keep those tokens intact.

export type AiProviderName = "openai" | "gemini" | "lovable";

interface ProviderConfig {
  name: AiProviderName;
  endpoint: string;
  model: string;
  headers: Record<string, string>;
}

function resolveProvider(): ProviderConfig {
  const forced = (process.env.AI_PROVIDER ?? "").trim().toLowerCase();
  const openaiKey = process.env.OPENAI_API_KEY ?? "";
  const geminiKey = process.env.GEMINI_API_KEY ?? "";
  const lovableKey = process.env.LOVABLE_API_KEY ?? "";

  const pick = (forced as AiProviderName) ||
    (openaiKey ? "openai" : geminiKey ? "gemini" : lovableKey ? "lovable" : "");

  if (pick === "openai") {
    if (!openaiKey) throw new Error("AI provider is openai but OPENAI_API_KEY is missing. [403]");
    return {
      name: "openai",
      endpoint: "https://api.openai.com/v1/chat/completions",
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      headers: { Authorization: `Bearer ${openaiKey}` },
    };
  }
  if (pick === "gemini") {
    if (!geminiKey) throw new Error("AI provider is gemini but GEMINI_API_KEY is missing. [403]");
    return {
      name: "gemini",
      // Google's OpenAI-compatible endpoint: same request/response shape.
      endpoint: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      model: process.env.GEMINI_MODEL ?? "gemini-flash-latest",
      headers: { Authorization: `Bearer ${geminiKey}` },
    };
  }
  if (pick === "lovable") {
    if (!lovableKey) throw new Error("AI provider is lovable but LOVABLE_API_KEY is missing. [403]");
    return {
      name: "lovable",
      endpoint: "https://ai.gateway.lovable.dev/v1/chat/completions",
      model: process.env.LOVABLE_MODEL ?? "google/gemini-3.6-flash",
      headers: { Authorization: `Bearer ${lovableKey}` },
    };
  }
  throw new Error("AI is not configured: set OPENAI_API_KEY (or GEMINI_API_KEY / LOVABLE_API_KEY). [403]");
}

/** True when some provider is configured; never throws. */
export function aiConfigured(): boolean {
  try {
    resolveProvider();
    return true;
  } catch {
    return false;
  }
}

/** Name + model for diagnostics lines, e.g. "openai (gpt-4o-mini)". */
export function aiProviderLabel(): string {
  try {
    const p = resolveProvider();
    return `${p.name} (${p.model})`;
  } catch {
    return "not configured";
  }
}

/** One JSON-mode chat completion. Returns the raw content string. */
export async function chatJSON(system: string, user: string): Promise<string> {
  const p = resolveProvider();
  const res = await fetch(p.endpoint, {
    method: "POST",
    headers: { ...p.headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: p.model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`AI provider ${p.name} failed [${res.status}]: ${body.slice(0, 500)}`);
    // OpenAI reports an out-of-money account as HTTP 429 + "insufficient_quota":
    // that is exhaustion, not a rate limit — treat it as terminal like a 402.
    if (res.status === 429 && /insufficient_quota/i.test(body))
      throw new Error(`AI credits exhausted for provider ${p.name}. [402]`);
    if (res.status === 402) throw new Error(`AI credits exhausted for provider ${p.name}. [402]`);
    if (res.status === 401 || res.status === 403)
      throw new Error(`AI key rejected by provider ${p.name} — check the API key. [403]`);
    if (res.status === 429) throw new Error("AI rate limit reached — try again shortly.");
    throw new Error(`AI request failed [${res.status}] (provider ${p.name})`);
  }

  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content ?? "";
  if (!content.trim()) throw new Error(`AI provider ${p.name} returned an empty response`);
  return content;
}
