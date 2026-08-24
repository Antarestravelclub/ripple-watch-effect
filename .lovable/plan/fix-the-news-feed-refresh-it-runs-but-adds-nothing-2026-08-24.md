# Fix the news feed refresh (it runs, but adds nothing)

## What the data shows

The schedule is not the problem. The ingestion job is already scheduled every 15 minutes and it is running: the last runs at 15:00, 15:15 and 15:45 UTC today all completed and reported success.

The problem is that every run creates zero events:

```text
run 15:45 UTC  ok=true  headlines_seen=40  events_created=0  skipped=5  error=null
run 15:15 UTC  ok=true  headlines_seen=40  events_created=0  skipped=5  error=null
```

The newest stored event was published 6 Aug and created 7 Aug — nothing has been added in five days, which is exactly what you see on the Today feed.

The run counters do not add up (40 headlines seen, only 5 accounted for, no error recorded), so the per-headline stage is dropping work without reporting why. The exact cause is not yet confirmed from the data alone — the run log does not record it. Confirming it is the first step of this plan, not an assumption.

Most likely candidates, in order: the AI exposure step failing for every headline (model id, credits or rate limit) and being swallowed as a silent skip; the freshness/dedupe filter rejecting everything; or the scheduled call hitting a published build that is older than the current ingestion code.

## What gets done

1. **Confirm the cause first**
   - Trigger one ingestion run manually and capture the real per-headline outcome and any AI gateway error text.
   - Verify the AI model id and gateway response, and that the scheduled URL is serving the current ingestion code.
   - Fix whatever that run exposes. No other change is made until the failing stage is identified.

2. **Never fail silently again**
   - Every run records, per stage, how many headlines were: already seen, too thin to analyse, rejected by the AI, stored with no listed-equity exposure, or successfully stored — with the first error message kept verbatim.
   - A run that sees 40 headlines and stores nothing is reported as degraded, not `ok`, so the Today page banner turns amber instead of showing a reassuring green timestamp.
   - The banner surfaces the reason ("AI exposure step failed", "no market-relevant headlines"), not just a time.

3. **Faster, more productive cadence**
   - Keep the 15-minute cycle, and raise the per-run analysis budget so a backlog of fresh headlines is actually worked through instead of five per run.
   - Widen the intake window and relax the "too thin to analyse" rule so headline-only wire stories are still evaluated.
   - Add a "Refresh now" button on the Today feed that runs ingestion on demand and shows the run result inline, so you never have to wait 15 minutes to see whether it works.

4. **Keep the feed honest**
   - Retention stays at 14 days; if the newest stored event is older than a few hours, the feed says so explicitly rather than presenting old news as today's ripples.

## Technical notes

- Diagnosis via a manual invocation of the ingestion engine plus AI gateway request logs; the fix follows from that output.
- `ingest_runs` gains stage-level counters and a first-error column; `runNewsIngest` writes them and returns `ok: false` when it stored nothing despite fresh candidates.
- Analysis cap, intake window and minimum-text rule in `news-ingest.server.ts` are raised/relaxed; ticker validation, signal generation and retention logic stay as they are.
- The existing `refreshNewsFeed` server function is wired to a UI control; the Today page status line renders degraded and reason states.
- Cron schedule is left at `*/15 * * * *`; if the scheduled URL turns out to serve a stale build, it is repointed at the stable URL that serves current code.

## Out of scope

Price pipeline, scorecard maths, setups scoring and disclaimers are unchanged.
