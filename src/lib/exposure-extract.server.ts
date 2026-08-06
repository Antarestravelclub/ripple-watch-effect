// Server-only exposure extraction against the Lovable AI Gateway.
// Uses plain JSON-mode completion + tolerant normalization so a slightly
// off-shape model answer still yields usable exposure rows.
import { EXPOSURE_SYSTEM_PROMPT, normalizeImpact, type ArticleImpact } from "./exposure-schema";

const ENDPOINT = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.6-flash";

const SHAPE = `Reply with ONLY a JSON object of this exact shape:
{
  "headline": string,
  "summary": string,
  "category": "Geopolitical" | "Central Bank" | "Commodity" | "Regulation" | "Tech" | "Weather/Disaster",
  "regions": string[],
  "transmissionChannel": string,
  "strength": "Low" | "Medium" | "High",
  "positive": [{ "ticker": string, "company": string, "sector": string, "mechanism": string, "confidence": "Low" | "Medium" | "High" }],
  "negative": [{ "ticker": string, "company": string, "sector": string, "mechanism": string, "confidence": "Low" | "Medium" | "High" }],
  "caveats": string
}
Use real primary exchange tickers (prefer US-listed lines or ADRs). If the article has no meaningful listed-equity exposure, return empty positive and negative arrays.`;

function parseJsonLoose(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("Model did not return JSON");
  }
}

export async function extractExposure(text: string, apiKey: string): Promise<ArticleImpact> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: `${EXPOSURE_SYSTEM_PROMPT}\n\n${SHAPE}` },
        { role: "user", content: `Analyse this article:\n\n${text}` },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`AI gateway failed [${res.status}]: ${body}`);
    if (res.status === 429) throw new Error("AI rate limit reached — try again shortly.");
    if (res.status === 402)
      throw new Error("AI credits exhausted for this workspace.");
    throw new Error(`AI request failed [${res.status}]`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content ?? "";
  if (!content.trim()) throw new Error("AI returned an empty response");
  return normalizeImpact(parseJsonLoose(content));
}
