// Server-only news ingestion engine.
// Pulls the latest market news, extracts equity exposure with the AI gateway,
// validates every ticker against the price feed, and stores events, exposures
// and auto-generated signals.
import {
  normalizeCategory,
  normalizeRegions,
  type ArticleImpact,
} from "./exposure-schema";
import type { EventCategory } from "./ripple-data";


const NEWS_URL = "https://finnhub.io/api/v1/news";
/** Feed categories scanned each run — broader world-event coverage. */
export const NEWS_CATEGORIES = ["general", "forex", "merger", "crypto"] as const;

/** Max headlines pulled per run, and max sent through the AI per run. */
export const HEADLINE_SCAN_CAP = 90;
export const AI_ANALYSE_CAP = 24;
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

export interface IngestStages {
  duplicates: number;
  tooThin: number;
  aiFailed: number;
  aiBlocked: boolean;
  noExposure: number;
  stored: number;
}

export interface IngestResult {
  ok: boolean;
  headlinesSeen: number;
  eventsCreated: number;
  skipped: number;
  signalsCreated: number;
  error: string | null;
  stages: IngestStages;
  detail: string[];
}

/** 402/403 from the AI gateway are terminal for the whole run (credit block,
 * policy block, stale key) — retrying headline after headline just burns time. */
function isTerminalAiError(message: string): boolean {
  return /\[(402|403)\]/.test(message) || /credits exhausted/i.test(message);
}

export async function runNewsIngest(): Promise<IngestResult> {
  const detail: string[] = [];
  const stages: IngestStages = {
    duplicates: 0,
    tooThin: 0,
    aiFailed: 0,
    aiBlocked: false,
    noExposure: 0,
    stored: 0,
  };
  const result: IngestResult = {
    ok: false,
    headlinesSeen: 0,
    eventsCreated: 0,
    skipped: 0,
    signalsCreated: 0,
    error: null,
    stages,
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
          stages: { ...stages, detail: detail.slice(0, 8) },
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

  const cutoff = Date.now() - 48 * 3_600_000;
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
  stages.duplicates = candidates.length - fresh.length;

  const { fetchQuoteWithRetry } = await import("./signal-prices.server");
  const { tickerMeta } = await import("./ticker-registry");
  const { createSignal, portfolioSettings } = await import("./signal-create.server");
  const portfolio = await portfolioSettings();
  // ETF universe for theme matching. Leveraged/inverse funds are excluded at source.
  const { suggestableEtfs, matchEtfs } = await import("./etf-reference.server");
  const etfUniverse = await suggestableEtfs().catch(() => []);


  const priceCache = new Map<string, Awaited<ReturnType<typeof fetchQuoteWithRetry>>>();
  async function priceFor(symbol: string) {
    const hit = priceCache.get(symbol);
    if (hit) return hit;
    const out = await fetchQuoteWithRetry(symbol);
    priceCache.set(symbol, out);
    return out;
  }

  for (const item of fresh.slice(0, AI_ANALYSE_CAP)) {
    const text = `${item.headline ?? ""}\n\n${item.summary ?? ""}`.trim();
    if (text.length < 60) {
      stages.tooThin++;
      continue;
    }
    let impact: ArticleImpact;
    try {
      const { extractExposure } = await import("./exposure-extract.server");
      impact = await extractExposure(text, aiKey);
    } catch (e) {
      const message = e instanceof Error ? e.message : "unknown error";
      stages.aiFailed++;
      if (isTerminalAiError(message)) {
        // Circuit breaker: a blocked/exhausted AI gateway fails every remaining
        // headline identically. Stop, mark the run failed, surface the reason.
        stages.aiBlocked = true;
        result.error = `AI exposure engine blocked: ${message}`;
        detail.push(
          `AI blocked after ${stages.aiFailed} attempt(s) — remaining ${
            fresh.length - stages.aiFailed
          } headline(s) parked until the next run.`,
        );
        result.skipped =
          stages.duplicates + stages.tooThin + stages.aiFailed + stages.noExposure;
        return finish();
      }
      detail.push(`AI extraction failed for "${item.headline}": ${message}`);
      continue;
    }

    const sides: Array<{ side: "tailwind" | "headwind"; rows: ArticleImpact["positive"] }> = [
      { side: "tailwind", rows: impact.positive ?? [] },
      { side: "headwind", rows: impact.negative ?? [] },
    ];
    if (sides.every((s) => s.rows.length === 0)) {
      stages.noExposure++;
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
      continue;
    }
    stages.stored++;
    result.eventsCreated++;

    for (const { side, rows } of sides) {
      for (const row of rows) {
        const raw = (row.ticker ?? "").trim().toUpperCase();
        if (!raw) continue;
        const meta = tickerMeta(raw);
        let needsReview = false;
        let reviewReason: string | null = null;
        let priced: number | null = null;
        let dayHigh: number | null = null;
        let dayLow: number | null = null;

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
            dayHigh = out.dayHigh ?? null;
            dayLow = out.dayLow ?? null;
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

        // Auto-generate an advisor-grade paper signal for validated names.
        // Rejected when the ticker has no usable daily history for ATR.
        if (!needsReview && priced != null && row.confidence !== "Low") {
          const dir = side === "tailwind" ? "long" : "short";
          const magnitude = (ev.strength as "Low" | "Medium" | "High") ?? "Medium";
          const outcome = await createSignal(
            {
              eventId: ev.id,
              ticker: raw,
              companyName: row.company ?? null,
              quoteSymbol: meta.quote,
              direction: dir,
              entryPrice: priced,
              dayHigh,
              dayLow,
              rationale: row.mechanism ?? "",
              strength: magnitude,
              confidence: (row.confidence as "Low" | "Medium" | "High") ?? "Medium",
              category: normalizeCategory(impact.category) as EventCategory,

              eventText: text,
              eventPublishedAt: publishedAt,
              generatedBy: "ripple-news-v2",
            },
            portfolio,
          );
          if (outcome.ok) result.signalsCreated++;
          else detail.push(`Signal rejected for ${raw}: ${outcome.reason}`);
        }

      }
    }

    // ---- ETF pass -------------------------------------------------------
    // Many events transmit through a sector, country or commodity fund rather
    // than one company. Matching is keyword-based and deterministic; direction
    // comes from the event's dominant stock side, and the usual ATR levels,
    // conviction rubric and sizing apply unchanged.
    const category = normalizeCategory(impact.category) as EventCategory;
    const etfMatches = matchEtfs(etfUniverse, text, category, 3);
    const longs = (impact.positive ?? []).length;
    const shorts = (impact.negative ?? []).length;
    const dominant: "long" | "short" | null =
      longs > shorts ? "long" : shorts > longs ? "short" : null;

    if (etfMatches.length > 0 && dominant == null) {
      detail.push(
        `ETF skipped for "${item.headline}": event has balanced winners and losers, no clear fund direction.`,
      );
    }

    if (dominant) {
      for (const match of etfMatches) {
        const sym = match.row.ticker.toUpperCase();
        const out = await priceFor(sym);
        const mechanism =
          `Fund-level exposure: ${match.row.name} tracks ${match.matched.join(", ")} ` +
          `named in this event.`;

        await supabaseAdmin.from("live_event_exposures").insert({
          live_event_id: ev.id,
          ticker: sym,
          company_name: match.row.name,
          side: dominant === "long" ? "tailwind" : "headwind",
          sector: match.row.category,
          mechanism,
          confidence: match.score >= 4 ? "High" : "Medium",
          quote_symbol: sym,
          needs_review: out.status !== "ok",
          review_reason: out.status !== "ok" ? (out.message ?? out.status) : null,
        });

        if (out.status !== "ok" || out.price == null) {
          detail.push(`ETF ${sym} skipped: ${out.message ?? out.status}`);
          continue;
        }
        const entry: number = out.price;

        const outcome = await createSignal(
          {
            eventId: ev.id,
            ticker: sym,
            companyName: match.row.name,
            quoteSymbol: sym,
            direction: dominant,
            entryPrice: entry,
            dayHigh: out.dayHigh ?? null,
            dayLow: out.dayLow ?? null,
            rationale: mechanism,
            strength: (ev.strength as "Low" | "Medium" | "High") ?? "Medium",
            confidence: match.score >= 4 ? "High" : "Medium",
            category,
            eventText: text,
            eventPublishedAt: publishedAt,
            generatedBy: "ripple-news-etf-v1",
            instrumentType: "etf",
          },
          portfolio,
        );
        if (outcome.ok) result.signalsCreated++;
        else detail.push(`ETF signal rejected for ${sym}: ${outcome.reason}`);
      }
    }
  }


  result.skipped =
    stages.duplicates + stages.tooThin + stages.aiFailed + stages.noExposure;

  // Retention: archive events beyond the window (keeps permalinks + open signals).
  const pruneBefore = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString();
  await supabaseAdmin
    .from("live_events")
    .update({ archived: true })
    .lt("published_at", pruneBefore)
    .eq("archived", false);


  // A run that saw fresh headlines but stored nothing is degraded, not fine —
  // say so and record why so the UI can show the real reason.
  if (result.eventsCreated === 0 && fresh.length > 0) {
    const analysed = fresh.slice(0, AI_ANALYSE_CAP).length - stages.tooThin;
    if (analysed > 0 && stages.noExposure === analysed && stages.aiFailed === 0) {
      result.ok = true; // genuinely quiet news cycle — nothing had equity exposure
    } else {
      result.ok = false;
      result.error =
        stages.aiFailed > 0
          ? `AI analysis failed for ${stages.aiFailed}/${analysed} headline(s).`
          : "No new events stored despite fresh headlines.";
    }
    return finish();
  }

  result.ok = true;
  return finish();
}
