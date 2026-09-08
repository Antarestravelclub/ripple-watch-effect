# Advisor-Grade Signals — Phase 1 (paper only)

Upgrades every new signal from a plain long/short call into a fully specified paper position: a 0–100 conviction score with its breakdown, a volatility-scaled stop and target, a suggested position size derived from risk, and a written kill condition. The Scorecard gains an honest headline: how the signals did versus simply holding the index.

Event ingestion, Today, Calendar, Analogues, Playbooks and the 15-minute check schedule are untouched.

## Decisions locked in

- If a ticker has fewer than 15 days of daily history, the signal is rejected as "insufficient history" — no estimated fallback.
- The 200+ signals already open keep their existing levels and finish out under the old rules. New rules apply to signals created from now on.
- Index entry prices for existing signals are backfilled from history so the alpha number has data immediately; backfilled entries are marked as estimated.

## What changes for the user

- **Signal card / detail page**: conviction score with a component breakdown (event severity, directness of exposure, historical analogue hit rate, freshness), stop, target, suggested size as a % of a $100,000 paper portfolio, and a plain-English kill condition. Signals scoring under 55 are kept and labelled "below threshold" with size 0 — tracked to learn from, not sized.
- **Scorecard**: a new benchmark section. Cumulative alpha versus the index is the visually primary stat, with total paper P/L, win rate and average R alongside. Per-closed-signal rows show signal return, index return over the identical window, and the difference. Alpha is broken down by event category and by conviction band (80+, 65–79, 55–64, below threshold). When cumulative alpha is negative a plain banner reads "Strategy currently underperforms holding the index."
- **Tracker**: statuses now distinguish stopped out, invalidated, target reached and expired, each with the trigger and prices recorded. Nothing is ever deleted.

## Technical plan

### Migrations

1. `signals`: add `conviction_score` int (0–100 check), `suggested_size_pct` numeric, `atr_at_signal` numeric, `stop_price` numeric, `invalidation_text` text, `invalidation_params` jsonb, `benchmark_symbol` text default `'SPY'`, `benchmark_entry_price` numeric, `benchmark_entry_estimated` boolean default false, `benchmark_exit_price` numeric, `mode` text default `'paper'` with a check constraint allowing `paper|live`, `below_threshold` boolean default false. `status` stays a text column; its check/allowed set extends to `open | closed | stopped | invalidated`. Existing rows keep `status`, `target_price` and `invalidation_price` untouched and get `mode='paper'`, `generated_by` unchanged, new columns null.
2. `portfolio_settings`: single-row table with `notional_value` default 100000, `risk_per_trade_pct` default 0.5, `max_position_pct` default 5, timestamps + update trigger. Seeded with one default row in the migration. Public read; no client writes.
3. `signal_evaluation_log`: `signal_id`, `trigger` (`stop|target|invalidation|expired`), `price`, `benchmark_price`, `detail` text, `created_at`. Public read, written only by the server.
4. GRANTs and RLS on each new table per project convention (`SELECT` to `anon`/`authenticated`, `ALL` to `service_role`); no client-side write policies.

Types regenerated after the migrations.

### New/updated server modules

- `src/lib/atr.server.ts` — fetch daily bars for a quote symbol, compute ATR(14), cached per symbol per run. Returns `null` when fewer than 15 bars are available so callers can reject.
- `src/lib/conviction.ts` (pure, client-safe) — rubric scorer: severity up to 35, directness up to 30, analogue hit rate up to 25, freshness 10 decaying to 0 across 24–72h. Returns total plus the component breakdown so the card can show it.
- `src/lib/position-sizing.ts` (pure) — `(risk_per_trade_pct × entry) / (1.5 × ATR × 100)`, capped at `max_position_pct`, scaled 1.0 / 0.75 / 0.5 by conviction band, 0 below 55.
- `src/lib/signal-create.server.ts` — the single guarded insert path. Validates that stop, target, invalidation params and score are all present; rejects with a clear error otherwise. Records `benchmark_entry_price` from the index quote at creation.
- `src/lib/analogue-stats.server.ts` — per-ticker directional hit rate from `historical_reactions` for the event's archetypes, feeding the conviction rubric.
- `src/lib/news-ingest.server.ts` — signal creation routed through `signal-create.server.ts`; unpriceable or history-less names are skipped with a recorded reason rather than inserted.
- `src/lib/signal-eval.server.ts` — same cron job, extended checks in order: stop hit (using existing intraday high/low logic) → `stopped`; target hit → `closed` reason target; `invalidation_params` → `invalidated`. v1 param types: `{max_days_open}`, `{close_beyond: price, direction}`, `{event_reversed: true}` (linked event archived). Old-style signals without the new columns continue on the existing target/invalidation/expiry path. Every close records the index price at that moment and writes an evaluation-log row.
- `src/lib/benchmark.server.ts` — index quote + historical close lookup, used for entry, exit, and the one-off backfill.
- `src/lib/signals.functions.ts` — new read function for portfolio settings and closed-signal alpha rows; a secured backfill server function that fills estimated index entry prices for existing signals.

### UI

- `src/components/signal-badge.tsx`, `src/routes/signal.$id.tsx`, `src/routes/tracker.tsx` — score + breakdown, stop/target, suggested size, kill condition, below-threshold and new status labels.
- `src/routes/scorecard.tsx` — benchmark section, alpha headline, breakdowns by category and conviction band, negative-alpha banner. Existing hit-rate table stays below it.
- `src/lib/signal-metrics.ts` — `SignalRow` extended with the new fields and statuses; alpha helpers added.

### Guardrails

- `mode` is written as `'paper'` in every insert; no UI control can set `live`.
- The backfill and any new write endpoint use the existing `x-cron-key` secured-hook pattern; no unauthenticated writes.
- Retention still archives, never deletes; stopped and invalidated signals persist.

## Verification after build

- Confirm old signals migrated with no data loss and still resolve on their original levels.
- Confirm the evaluation cron handles `stopped` and `invalidated` and logs every close.
- Create one test signal end-to-end and confirm score, size, stop, target and invalidation are all populated.
