# Live news feed, refreshed every 15 minutes

## What's happening now

The Today feed is not stale because of a bug — it has no news source at all. All 10 events are hardcoded in `src/lib/ripple-data.ts` with fixed timestamps from 26 July 2026, so the feed can never change. Only prices update live; the events, their sectors and their tickers are frozen mock data. The 15-minute schedule that exists today only refreshes price snapshots for signals.

So: replace the mock event list with real ingested news, mapped to affected tickers, on a 15-minute cycle.

## What gets built

1. **Live event store in the backend**
   - `live_events`: headline, summary, why-markets-care, source, source URL, published timestamp, category, ripple magnitude (High/Medium/Low), regions, transmission channel, dedupe key.
   - `live_event_exposures`: one row per affected ticker — side (tailwind/headwind), sector, mechanism text, confidence, resolved quote symbol.
   - Public read-only access; writes only from the ingestion job.

2. **Ingestion job every 15 minutes**
   - New endpoint `/api/public/hooks/ingest-news`, scheduled with a 15-minute cron.
   - Pulls the latest market/general news from the existing market data provider (the same key already configured), de-duplicates against recent headlines by URL and normalised title.
   - Each genuinely new, market-relevant headline is run through the same AI exposure engine already used by the Analyser page: it returns category, region, magnitude, transmission channel, and the positively and negatively exposed tickers with mechanisms.
   - Every returned ticker is validated against the price source before being stored. Unresolvable or non-traded names are flagged for review, not displayed — the rule already applied to signals.
   - Signals are auto-generated for validated, high-confidence exposures using the existing snapshot / target / invalidation logic, so the tracker and scorecard keep working on real events.
   - Retention: events older than 14 days are pruned so the feed stays current.

3. **Today feed reads live data**
   - Home page, event detail, watchlist matching, sector heat and region filters read ingested events instead of the static array.
   - Existing freshness behaviour is kept: age pill in hours, High-ripple-first sorting, and the collapsed "Older ripples" section for anything over 48h.
   - Header stamp is extended to show the last successful news ingestion alongside the last quote refresh.
   - If ingestion has never run or fails, the feed shows an explicit empty/degraded state with the failure reason rather than silently showing old data.

4. **Static mock events retired**
   - `src/lib/ripple-data.ts` keeps its types and sector mapping but stops being the feed source, so there is no way for stale placeholder news to reappear.

## Technical notes

- New migration for `live_events` + `live_event_exposures` with GRANTs, RLS and public SELECT policies; a unique dedupe index on the source URL.
- `src/routes/api/public/hooks/ingest-news.ts` (server route under `/api/public/*`), using `supabaseAdmin` loaded inside the handler; pg_cron + pg_net scheduled `*/15 * * * *` against the stable project URL.
- Exposure extraction reuses `ArticleImpactSchema` and the Lovable AI gateway path from `article-analysis.functions.ts`, extracted into a shared server-only helper so both the Analyser and the ingestion job use one code path.
- Ticker validation reuses `src/lib/ticker-registry.ts` and the quote lookup in `quotes.server.ts`; signal creation reuses `signal-levels.ts`.
- New `live-events.functions.ts` server functions for reading the feed and a single event, consumed via route loaders with TanStack Query.
- Per-run caps on the number of AI-analysed headlines to keep cost and latency bounded.

## Out of scope

No change to disclaimers, the scorecard maths, the Analyser UI, or the historical analogues library.
