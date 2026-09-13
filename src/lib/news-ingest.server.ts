// Server-only news ingestion engine.
// Pulls the latest market news from the market-data feed plus every enabled RSS
// source (CNBC), deduplicates stories across sources, scores each new candidate
// for materiality, then extracts equity exposure with the AI gateway, validates
// every ticker against the price feed and stores events, exposures and signals.
import {
  normalizeCategory,
  normalizeRegions,
  type ArticleImpact,
} from "./exposure-schema";
import { normalizeTitle, normalizeUrl } from "./news-normalize";
import {
  IMPACT_THRESHOLD,
  RUN_ACCEPT_CAP,
  eventCategoryFor,
  scoreMateriality,
  type Materiality,
} from "./materiality.server";
import type { EventCategory } from "./ripple-data";

const NEWS_URL = "https://finnhub.io/api/v1/news";
/** Feed categories scanned each run — broader world-event coverage. */
export const NEWS_CATEGORIES = ["general", "forex", "merger", "crypto"] as const;

/** Max headlines pulled per run, max scored by the classifier, max analysed. */
export const HEADLINE_SCAN_CAP = 120;
export const CLASSIFY_CAP = 40;
export const AI_ANALYSE_CAP = 24;
export const RETENTION_DAYS = 14;
/** A source that has not succeeded in this long is treated as stale. */
export const SOURCE_STALE_HOURS = 12;

interface Candidate {
  headline: string;
  summary: string;
  sourceName: string;
  url: string | null;
  guid: string | null;
  publishedAt: string;
}

export function dedupeKeyFor(item: { url?: string | null; headline?: string | null }): string {
  const url = normalizeUrl(item.url ?? null);
  if (url) return url;
  return normalizeTitle(item.headline ?? "").slice(0, 160);
}

export interface SourceStatus {
  name: string;
  ok: boolean;
  items: number;
  error: string | null;
}

export interface IngestStages {
  duplicates: number;
  tooThin: number;
  aiFailed: number;
  aiBlocked: boolean;
  noExposure: number;
  stored: number;
  fetched: number;
  deduped: number;
  newCandidates: number;
  accepted: number;
  rejectedLowImpact: number;
  sources: SourceStatus[];
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
    fetched: 0,
    deduped: 0,
    newCandidates: 0,
    accepted: 0,
    rejectedLowImpact: 0,
    sources: [],
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
          stages: JSON.parse(
            JSON.stringify({ ...stages, detail: detail.slice(0, 10) }),
          ),
        })
        .eq("id", runId);
    }
    return result;
  };

  if (!aiKey) {
    result.error = "AI exposure engine is not configured.";
    return finish();
  }

  const items: Candidate[] = [];

  // ---- Market data feed ---------------------------------------------------
  if (feedKey) {
    const fetched = await Promise.all(
      NEWS_CATEGORIES.map(async (category) => {
        try {
          const res = await fetch(`${NEWS_URL}?category=${category}&token=${feedKey}`);
          if (!res.ok) return { category, rows: [], error: `HTTP ${res.status}` };
          return { category, rows: (await res.json()) as Array<Record<string, unknown>>, error: null };
        } catch (e) {
          return {
            category,
            rows: [] as Array<Record<string, unknown>>,
            error: e instanceof Error ? e.message : "unreachable",
          };
        }
      }),
    );
    for (const f of fetched) {
      const rows = Array.isArray(f.rows) ? f.rows : [];
      stages.sources.push({
        name: `Market feed · ${f.category}`,
        ok: !f.error,
        items: rows.length,
        error: f.error,
      });
      if (f.error) {
        detail.push(`Feed "${f.category}" failed: ${f.error}`);
        continue;
      }
      for (const r of rows) {
        const dt = Number(r.datetime ?? 0);
        items.push({
          headline: String(r.headline ?? "").trim(),
          summary: String(r.summary ?? "").trim(),
          sourceName: String(r.source ?? "News feed"),
          url: (r.url as string) ?? null,
          guid: r.id != null ? `finnhub:${String(r.id)}` : null,
          publishedAt: dt > 0 ? new Date(dt * 1000).toISOString() : new Date().toISOString(),
        });
      }
    }
  } else {
    stages.sources.push({
      name: "Market feed",
      ok: false,
      items: 0,
      error: "Market news feed key is not configured.",
    });
  }

  // ---- RSS sources (CNBC) -------------------------------------------------
  const { data: rssSources } = await supabaseAdmin
    .from("news_sources")
    .select("id,name,url,enabled")
    .eq("enabled", true)
    .order("name");

  if ((rssSources ?? []).length > 0) {
    const { fetchRss } = await import("./rss.server");
    const results = await Promise.all(
      (rssSources ?? []).map(async (s) => ({ source: s, out: await fetchRss(s.url) })),
    );
    for (const { source, out } of results) {
      stages.sources.push({
        name: source.name,
        ok: out.ok,
        items: out.items.length,
        error: out.error,
      });
      await supabaseAdmin
        .from("news_sources")
        .update(
          out.ok
            ? { last_success_at: new Date().toISOString(), last_error: null }
            : { last_error: out.error },
        )
        .eq("id", source.id);
      if (!out.ok) {
        detail.push(`Source "${source.name}" failed: ${out.error}`);
        continue;
      }
      for (const i of out.items) {
        items.push({
          headline: i.title.trim(),
          summary: i.description.trim(),
          sourceName: source.name,
          url: i.link,
          guid: i.guid,
          publishedAt: i.pubDate ?? new Date().toISOString(),
        });
      }
    }
  }

  stages.fetched = items.length;
  if (items.length === 0) {
    result.error = "No headlines returned by any news source.";
    return finish();
  }

  // ---- Within-run dedupe --------------------------------------------------
  const cutoff = Date.now() - 48 * 3_600_000;
  const withinRun = new Map<string, Candidate>();
  for (const i of items
    .filter((i) => i.headline.length > 20)
    .filter((i) => new Date(i.publishedAt).getTime() > cutoff)
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())) {
    const key = dedupeKeyFor(i);
    if (!withinRun.has(key)) withinRun.set(key, i);
  }
  const candidates = [...withinRun.values()].slice(0, HEADLINE_SCAN_CAP);
  result.headlinesSeen = candidates.length;

  // ---- Cross-run dedupe: exact key, exact source url, then fuzzy title ----
  const keys = candidates.map(dedupeKeyFor);
  const { data: existing } = await supabaseAdmin
    .from("live_events")
    .select("id,dedupe_key,published_at")
    .in("dedupe_key", keys.length > 0 ? keys : ["__none__"]);
  const byKey = new Map((existing ?? []).map((r) => [r.dedupe_key, r]));

  const urls = candidates.map((c) => normalizeUrl(c.url)).filter(Boolean) as string[];
  const { data: knownSources } = await supabaseAdmin
    .from("event_sources")
    .select("event_id,url")
    .in("url", urls.length > 0 ? urls : ["__none__"]);
  const byUrl = new Map((knownSources ?? []).map((r) => [r.url ?? "", r.event_id]));

  async function attachSource(eventId: string, c: Candidate) {
    const { error: srcErr } = await supabaseAdmin.from("event_sources").upsert(
      {
        event_id: eventId,
        source_name: c.sourceName,
        url: normalizeUrl(c.url) ?? c.url,
        pub_date: c.publishedAt,
      },
      { onConflict: "event_id,url", ignoreDuplicates: true },
    );
    // A silent failure here would hide multi-source stories, so surface it.
    if (srcErr && !/duplicate key/i.test(srcErr.message))
      detail.push(`Source link failed for "${c.sourceName}": ${srcErr.message}`);
    // Keep the earliest publication time as the event time.
    const { data: ev } = await supabaseAdmin
      .from("live_events")
      .select("published_at")
      .eq("id", eventId)
      .maybeSingle();
    if (ev && new Date(c.publishedAt).getTime() < new Date(ev.published_at).getTime()) {
      await supabaseAdmin
        .from("live_events")
        .update({ published_at: c.publishedAt })
        .eq("id", eventId);
    }
  }

  const fresh: Candidate[] = [];
  for (const c of candidates) {
    const titleNorm = normalizeTitle(c.headline);
    const exact = byKey.get(dedupeKeyFor(c));
    const urlHit = byUrl.get(normalizeUrl(c.url) ?? "");
    let matchId: string | null = exact?.id ?? urlHit ?? null;

    if (!matchId && titleNorm.length > 12) {
      const { data: fuzzy } = await supabaseAdmin.rpc("match_recent_event", {
        p_title_norm: titleNorm,
        p_threshold: 0.55,
      });
      const hit = Array.isArray(fuzzy) ? fuzzy[0] : null;
      if (hit?.id) matchId = hit.id as string;
    }

    if (matchId) {
      stages.deduped++;
      stages.duplicates++;
      await attachSource(matchId, c);
      continue;
    }
    fresh.push(c);
  }
  stages.newCandidates = fresh.length;

  // ---- Materiality scoring -----------------------------------------------
  const scored: Array<{ candidate: Candidate; impact: Materiality }> = [];
  for (const c of fresh.slice(0, CLASSIFY_CAP)) {
    let impact: Materiality;
    try {
      impact = await scoreMateriality(`${c.headline}\n\n${c.summary}`.trim(), aiKey);
    } catch (e) {
      const message = e instanceof Error ? e.message : "unknown error";
      stages.aiFailed++;
      if (isTerminalAiError(message)) {
        stages.aiBlocked = true;
        result.error = `AI impact classifier blocked: ${message}`;
        return finish();
      }
      detail.push(`Impact scoring failed for "${c.headline}": ${message}`);
      continue;
    }

    if (impact.impact_score < IMPACT_THRESHOLD) {
      stages.rejectedLowImpact++;
      await supabaseAdmin.from("rejected_headlines").insert({
        headline: c.headline,
        source: c.sourceName,
        url: c.url,
        impact_score: impact.impact_score,
        reason: impact.reasoning || "below impact threshold",
        run_id: runId,
      });
      continue;
    }
    scored.push({ candidate: c, impact });
  }

  scored.sort((a, b) => b.impact.impact_score - a.impact.impact_score);
  const accepted = scored.slice(0, Math.min(RUN_ACCEPT_CAP, AI_ANALYSE_CAP));
  for (const overflow of scored.slice(accepted.length)) {
    await supabaseAdmin.from("rejected_headlines").insert({
      headline: overflow.candidate.headline,
      source: overflow.candidate.sourceName,
      url: overflow.candidate.url,
      impact_score: overflow.impact.impact_score,
      reason: "run_cap",
      run_id: runId,
    });
  }
  stages.accepted = accepted.length;

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

  for (const { candidate: item, impact: materiality } of accepted) {
    const text = `${item.headline}\n\n${item.summary}`.trim();
    if (text.length < 40) {
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
          `AI blocked after ${stages.aiFailed} attempt(s) — remaining headline(s) parked until the next run.`,
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

    const publishedAt = item.publishedAt;

    const { data: ev, error: evErr } = await supabaseAdmin
      .from("live_events")
      .insert({
        headline: item.headline || impact.headline,
        summary: impact.summary,
        why_markets_care: impact.summary || materiality.reasoning,
        source: item.sourceName,
        source_url: item.url ?? null,
        published_at: publishedAt,
        category: normalizeCategory(impact.category || eventCategoryFor(materiality.category)),
        strength: impact.strength,
        regions: normalizeRegions(impact.regions),
        transmission_channel: impact.transmissionChannel,
        dedupe_key: dedupeKeyFor(item),
        title_norm: normalizeTitle(item.headline),
        impact_score: materiality.impact_score,
        impact_direction: materiality.impact_direction,
        impact_category: materiality.category,
        impact_reasoning: materiality.reasoning,
      })
      .select("id,strength")
      .maybeSingle();
    if (evErr || !ev) {
      detail.push(`Store failed for "${item.headline}": ${evErr?.message ?? "no row"}`);
      continue;
    }
    stages.stored++;
    result.eventsCreated++;
    await attachSource(ev.id, item);

    if (sides.every((s) => s.rows.length === 0)) stages.noExposure++;

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
    stages.duplicates + stages.tooThin + stages.aiFailed + stages.rejectedLowImpact;

  // Retention: archive events beyond the window (keeps permalinks + open signals).
  const pruneBefore = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString();
  await supabaseAdmin
    .from("live_events")
    .update({ archived: true })
    .lt("published_at", pruneBefore)
    .eq("archived", false);

  const allSourcesFailed =
    stages.sources.length > 0 && stages.sources.every((s) => !s.ok);
  if (allSourcesFailed) {
    result.ok = false;
    result.error = "Every news source failed this run.";
    return finish();
  }

  // A run that saw fresh candidates but stored nothing is only fine when the
  // classifier honestly rejected them all as noise.
  if (result.eventsCreated === 0 && stages.newCandidates > 0) {
    if (stages.accepted === 0 && stages.aiFailed === 0) {
      result.ok = true; // quiet news cycle — nothing scored above the threshold
    } else if (stages.aiFailed > 0) {
      result.ok = false;
      result.error = `AI analysis failed for ${stages.aiFailed} headline(s).`;
    } else {
      result.ok = false;
      result.error = "No new events stored despite material headlines.";
    }
    return finish();
  }

  result.ok = true;
  return finish();
}
