# Add any symbol to the Blotter

Today a paper trade can only start from a live signal, so a symbol like NVDA with no current signal has no "Paper trade" button anywhere. Two additions fix that.

## 1. "New paper trade" on the Blotter

A button at the top of the Blotter opens a form where you type:

- Symbol (with the existing symbol search, so it validates against real tickers)
- Direction: long or short
- Entry price — pre-filled with the latest stored price for that symbol
- Stop and target — suggested from the symbol's recent volatility (same 1.5x / 2.0x ATR rule signals use); fully editable, and left blank if there isn't enough price history
- Position size — suggested from the same $100,000 paper notional and 0.5% risk-per-trade rule
- Optional notes

The trade then behaves exactly like a signal-based one: live profit/loss, distance to stop and target, manual close, and automatic stop/target exits on the existing 15-minute weekday check. It still skips (never closes) on a stale price feed. There is no signal to invalidate, so these trades exit on stop, target, or your manual close only.

## 2. "Paper trade" button on symbol pages

On a symbol page (e.g. /tickers/NVDA), each active signal row gets the same "Paper trade" button that the Tracker has. Symbols with no active signal instead get a "Paper trade this symbol" button that opens the free-form form above, pre-filled with that symbol.

## 3. Stats stay separated

The Stats tab keeps signal-based and free-form results apart:

- Headline numbers default to signal-based trades (that is what measures signal quality)
- A toggle switches to free-form trades, or to all trades combined
- Each closed trade row is labelled "From signal" or "Manual", and the closed-trades list gets a filter for it
- The small-sample warning applies per selected set

## Technical notes

- Migration: make `paper_trades.signal_id` nullable and add `source text not null default 'signal'` constrained to `signal | manual`, with an index on `(user_id, source)`. Existing rows keep `source = 'signal'`. Regenerate types.
- New server functions in `src/lib/paper-trades.functions.ts`: `manualTradePrefill` (latest price from `latest_prices` + `atrFor` + sizing from `portfolio_settings`) and `openManualPaperTrade` (validated insert with `source = 'manual'`, same one-open-trade-per-symbol-and-direction guard).
- `listPaperTrades` returns `source`; the signal join tolerates a null `signal_id`.
- `src/lib/paper-trade-eval.server.ts`: split the loop so manual trades skip the signal/snapshot lookups and evaluate stop/target against `latest_prices` day high/low; log them without a `signal_id` write to `signal_evaluation_log`.
- `src/components/paper-trade-dialog.tsx`: extract the shared form; add a manual mode plus a standalone `ManualPaperTradeButton`.
- `src/lib/paper-trades.ts`: add a source split to `splitStats` and thread the selected set through `computeStats` / `equityCurve`.
- UI touch points: `src/routes/_authenticated/blotter.tsx`, `src/routes/tickers.$symbol.tsx`, and a short Blotter note in `src/routes/manual.tsx`.
- Unchanged: signal creation, conviction scoring, price fetching, cron schedules, and the Scorecard.
