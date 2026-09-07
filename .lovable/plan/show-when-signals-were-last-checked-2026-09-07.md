# Show when signals were last checked

Everything from the previous round is confirmed working: both scheduled jobs carry the private key, calls without it are rejected, automatic evaluation ran overnight on its own, and the feed is unchanged. The one thing left is making the automatic checking visible.

## What you'll see

A small line near the top of the Scorecard: "Last checked 12 minutes ago — 3 reached target, 1 stopped out", plus a note that checks run automatically every 15 minutes on weekdays. If a check ever fails, that line says so instead of showing a stale time.

## How it works

- Record each evaluation run's finish time and outcome counts so the page can read the real last run, not just the one triggered by opening the page.
- A small server function returns the latest run summary; the Scorecard shows it above the stats and refreshes it every minute.
- Keep the existing on-page-load check as a fallback; the readout reflects whichever ran most recently.

## Technical notes

- New table `evaluation_runs` (finished at, evaluated, target hits, invalidated, expired, relevelled, ok, error) with public read access; `runEvaluation` in `src/lib/signal-eval.server.ts` writes one row per run.
- New `lastEvaluationRun` server function in `src/lib/signals.functions.ts` reading the newest row.
- `src/routes/scorecard.tsx` renders the readout via a query with a 60s refetch interval; no other page changes.
