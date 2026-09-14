# Add your own signals to the Tracker

Today, signals only come from the news engine — there is no way to log your own idea. This adds "Add my signal": you enter a symbol, direction and thesis, the app scores it with the same conviction rubric and volatility-based stop/target as engine signals, and it appears in the Tracker with a one-click "Paper trade" button.

## 1. "Add my signal" form (signed-in only)

A button at the top of the Tracker (and on each ticker page) opens a form:

- Symbol (existing symbol search, validated against real tickers)
- Direction: long or short
- Your thesis (required — this becomes the signal's rationale)
- Your read on strength and confidence (Low / Medium / High) — feeds the conviction score

On submit the app runs the exact same pipeline as engine signals:

- Latest stored price becomes the entry (rejected if no price feed for the symbol)
- ATR(14) from daily history sets the stop (1.5× ATR) and target (2.0× ATR) — rejected with a clear message if there isn't enough history
- Conviction score from the same rubric (strength, confidence, whether the thesis names the company, historical analogue hit-rate, freshness). Below-threshold signals are flagged but still tracked — same rule as the engine
- Risk-based position size suggestion from your paper account settings
- The same kill conditions: close beyond the stop, thesis superseded, or expiry after the usual trading-day window

## 2. Your signals in the Tracker

- Marked with a "Mine" badge so they are visually distinct from engine signals
- A "Mine / Engine / All" filter on the Tracker; default stays All
- They open the same signal detail page, get the same 15-minute price checks, and resolve to target / invalidated / expired exactly like engine signals
- Each row gets the existing "Paper trade" button, pre-filled from the signal — one click to open the trade in your Trade Log
- The Scorecard keeps them separate: headline stats stay engine-only, with a toggle to include or isolate your own signals (mirrors the Trade Log's signal-vs-manual split)

## 3. Ownership and visibility

- Your signals are owned by your account and visible to you in the Tracker. (They ride the same public research feed as engine signals, consistent with how all signals work today — flag it here if you'd rather keep them private to you.)
- Only you can create signals under your name; the create path is a signed-in-only server function.

## Technical notes

- Migration: add nullable `user_id uuid references auth.users(id)` to `signals`, index on `(user_id)`, generated types regenerate. Existing rows keep `user_id = null` (engine signals).
- New `createManualSignal` in a client-safe functions file (signed-in, `requireSupabaseAuth`): reuses `atrFor`, `atrLevels`, `scoreConviction`, `analogueHitRate`, `suggestedSizePct`, `benchmarkPrice` from the existing signal-create path; inserts with `generated_by = 'manual'`, `event_id = 'manual:<uuid>'`, `mode = 'paper'`, the user's `user_id`, and a `price_snapshots` row.
- `signal-eval.server.ts`: the daily evaluation re-levels from event magnitude — manual signals fall back to the user-selected strength so they evaluate identically otherwise (stop/target/expiry against `latest_prices`).
- `listSignals` / signal metrics: expose `user_id` and `generated_by`; Tracker UI adds the Mine badge + filter; `signal.$id.tsx` already handles non-event signals ("Earlier event" fallback).
- `paperTradePrefill` / `openPaperTrade` already work for any signal id — no change needed for the one-click paper trade.
- Scorecard: `src/lib/paper-trades.ts`-style split applied to signal stats via `generated_by`.
- Manual page: short new section explaining "Add my signal".
- Unchanged: news ingestion, engine signal creation, the bridge/mirror path, cron schedules.
