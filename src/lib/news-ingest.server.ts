// Server-only news ingestion engine.
// Pulls the latest market news, extracts equity exposure with the AI gateway,
// validates every ticker against the price feed, and stores events, exposures
// and auto-generated signals.
import {
  ArticleImpactWireSchema,
  normalizeImpact,
  EXPOSURE_SYSTEM_PROMPT,
  normalizeCategory,
  normalizeRegions,
  type ArticleImpact,
} from "./exposure-schema";

const NEWS_URL = "https://finnhub.io/api/v1/news?category=general";

/** Max headlines pulled per run, and max sent through the AI per run. */
export const HEADLINE_SCAN_CAP = 40;
export const AI_ANALYSE_CAP = 5;
export const RETENTION_DAYS = 14;

interface NewsItem {
  headline?: string;
  summary?: string;
  source?: string;
  url?: string;
  datetime?: number;
  id?: number;
}

export function dedupeKeyFor(item: NewsItem): string {
  if (item.url) return item.url.split("?")[0]!.toLowerCase();
  return (item.headline ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

async function extractExposure(text: string, apiKey: string): Promise<ArticleImpact> {
  const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
  const { generateText, Output } = await import("ai");
  const gateway = createLovableAiGatewayProvider(apiKey);
  const { output } = await generateText({
    model: gateway("google/gemini-3.6-flash"),
    output: Output.object({ schema: ArticleImpactWireSchema }),
    system: EXPOSURE_SYSTEM_PROMPT,
    prompt: `Analyse this article:\n\n${text}`,
  });
  return normalizeImpact(output);
}

export interface IngestResult {
  ok: boolean;
  headlinesSeen: number;
  eventsCreated: number;
  skipped: number;
  signalsCreated: number;
  error: string | null;
  detail: string[];
}

export async function runNewsIngest(): Promise<IngestResult> {
  const detail: string[] = [];
  const result: IngestResult = {
    ok: false,
    headlinesSeen: 0,
    eventsCreated: 0,
    skipped: 0,
    signalsCreated: 0,
    error: null,
    detail,
  };

  const feedKey = process.env.FINNHUB_API_KEY ?? "";
  const aiKey = process.env.LOVABLE_API_KEY ?? "";
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: runRow } = await supabaseAdmin
    .from("ingest_runs")
    .insert({})
    .select("id")
    .maybeSingle();
  const runId = runRow?.id ?? null;

  const finish = async () => {
    if (runId) {
      await supabaseAdmin
        .from("ingest_runs")
        .update({
          finished_at: new Date().toISOString(),
          headlines_seen: result.headlinesSeen,
          events_created: result.eventsCreated,
          skipped: result.skipped,
          signals_created: result.signalsCreated,
          ok: result.ok,
          error: result.error,
        })
        .eq("id", runId);
    }
    return result;
  };

  if (!feedKey) {
    result.error = "Market news feed key is not configured.";
    return finish();
  }
  if (!aiKey) {
    result.error = "AI exposure engine is not configured.";
    return finish();
  }

  let items: NewsItem[] = [];
  try {
    const res = await fetch(`${NEWS_URL}&token=${feedKey}`);
    if (!res.ok) {
      result.error = `News feed returned HTTP ${res.status}`;
      return finish();
    }
    items = (await res.json()) as NewsItem[];
  } catch (e) {
    result.error = e instanceof Error ? e.message : "News feed unreachable";
    return finish();
  }

  const cutoff = Date.now() - 36 * 3_600_000;
  const candidates = items
    .filter((i) => (i.headline ?? "").trim().length > 20)
    .filter((i) => !i.datetime || i.datetime * 1000 > cutoff)
    .sort((a, b) => (b.datetime ?? 0) - (a.datetime ?? 0))
    .slice(0, HEADLINE_SCAN_CAP);
  result.headlinesSeen = candidates.length;

  const keys = candidates.map(dedupeKeyFor);
  const { data: existing } = await supabaseAdmin
    .from("live_events")
    .select("dedupe_key")
    .in("dedupe_key", keys.length > 0 ? keys : ["__none__"]);
  const seen = new Set((existing ?? []).map((r) => r.dedupe_key));

  const fresh = candidates.filter((i) => !seen.has(dedupeKeyFor(i)));
  result.skipped = candidates.length - fresh.length;

  const { fetchQuoteWithRetry, sleep } = await import("./signal-prices.server");
  const { tickerMeta } = await import("./ticker-registry");
  const { levelsFor } = await import("./signal-levels");

  const priceCache = new Map<string, Awaited<ReturnType<typeof fetchQuoteWithRetry>>>();
  async function priceFor(symbol: string) {
    const hit = priceCache.get(symbol);
    if (hit) return hit;
    const out = await fetchQuoteWithRetry(symbol, feedKey);
    priceCache.set(symbol, out);
    await sleep(200);
    return out;
  }

  for (const item of fresh.slice(0, AI_ANALYSE_CAP)) {
    const text = `${item.headline ?? ""}\n\n${item.summary ?? ""}`.trim();
    if (text.length < 80) {
      result.skipped++;
      continue;
    }
    let impact: ArticleImpact;
    try {
      impact = await extractExposure(text, aiKey);
    } catch (e) {
      detail.push(
        `AI extraction failed for "${item.headline}": ${
          e instanceof Error ? e.message : "unknown error"
        }`,
      );
      result.skipped++;
      continue;
    }

    const sides: Array<{ side: "tailwind" | "headwind"; rows: ArticleImpact["positive"] }> = [
      { side: "tailwind", rows: impact.positive ?? [] },
      { side: "headwind", rows: impact.negative ?? [] },
    ];
    if (sides.every((s) => s.rows.length === 0)) {
      result.skipped++;
      continue;
    }

    const publishedAt = item.datetime
      ? new Date(item.datetime * 1000).toISOString()
      : new Date().toISOString();

    const { data: ev, error: evErr } = await supabaseAdmin
      .from("live_events")
      .insert({
        headline: item.headline ?? impact.headline,
        summary: impact.summary,
        why_markets_care: impact.summary,
        source: item.source ?? "News feed",
        source_url: item.url ?? null,
        published_at: publishedAt,
        category: normalizeCategory(impact.category),
        strength: impact.strength,
        regions: normalizeRegions(impact.regions),
        transmission_channel: impact.transmissionChannel,
        dedupe_key: dedupeKeyFor(item),
      })
      .select("id,strength")
      .maybeSingle();
    if (evErr || !ev) {
      detail.push(`Store failed for "${item.headline}": ${evErr?.message ?? "no row"}`);
      result.skipped++;
      continue;
    }
    result.eventsCreated++;

    for (const { side, rows } of sides) {
      for (const row of rows) {
        const raw = (row.ticker ?? "").trim().toUpperCase();
        if (!raw) continue;
        const meta = tickerMeta(raw);
        let needsReview = false;
        let reviewReason: string | null = null;
        let priced: number | null = null;

        if (!meta.tradable) {
          needsReview = true;
          reviewReason = meta.note ?? "Not publicly traded";
        } else {
          const out = await priceFor(meta.quote);
          if (out.status !== "ok") {
            needsReview = true;
            reviewReason = out.message ?? out.status;
          } else {
            priced = out.price;
          }
        }

        await supabaseAdmin.from("live_event_exposures").insert({
          live_event_id: ev.id,
          ticker: raw,
          company_name: row.company ?? null,
          side,
          sector: row.sector ?? "",
          mechanism: row.mechanism ?? "",
          confidence: row.confidence ?? "Medium",
          quote_symbol: meta.tradable ? meta.quote : null,
          needs_review: needsReview,
          review_reason: reviewReason,
        });

        // Auto-generate a tracked signal for validated, non-low-confidence names.
        if (!needsReview && priced != null && row.confidence !== "Low") {
          const dir = side === "tailwind" ? "long" : "short";
          const magnitude = (ev.strength as "Low" | "Medium" | "High") ?? "Medium";
          const lv = levelsFor(priced, dir, magnitude);
          const { data: sig } = await supabaseAdmin
            .from("signals")
            .insert({
              event_id: ev.id,
              ticker: raw,
              company_name: row.company ?? null,
              direction: dir,
              conviction: row.confidence === "High" ? 5 : 3,
              rationale: row.mechanism ?? "",
              generated_by: "ripple-news-v1",
              signal_price: priced,
              quote_symbol: meta.quote,
              price_status: "ok",
              target_price: lv.target,
              invalidation_price: lv.invalidation,
            })
            .select("id")
            .maybeSingle();
          if (sig) {
            await supabaseAdmin
              .from("price_snapshots")
              .insert({ signal_id: sig.id, ticker: raw, price: priced });
            result.signalsCreated++;
          }
        }
      }
    }
  }

  // Retention: drop events beyond the window so the feed can never go stale.
  const pruneBefore = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString();
  await supabaseAdmin.from("live_events").delete().lt("published_at", pruneBefore);

  result.ok = true;
  return finish();
}
