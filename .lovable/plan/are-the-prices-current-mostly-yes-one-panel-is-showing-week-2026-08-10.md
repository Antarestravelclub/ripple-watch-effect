# Are the prices current? Mostly yes — one panel is showing week-old data

## What I checked

- Live quote feed: real and correct. The stream returns fresh Finnhub data (AAPL 312.42, FRO 39.55, CCL 29.22), last tick 19:08 UTC today, correctly labelled "market closed" since the US session has ended.
- Snapshot cron: running. 40 new price snapshots in the last hour, newest at 20:45 UTC today.
- Setups / event cards / ticker pages: prices come from the live stream, so those are current.

## The problem: the "Market moves" panel

That panel does not use the live feed. It walks every signal in the database — including **closed** ones — and uses each signal's last stored snapshot. The tickers on display right now (AAPL, INTC, AMD, SMCI, GOOGL) are all closed signals whose last snapshot was captured **July 30–31**. So:

- AAPL shows $301.83 while the live price is $312.42.
- The "-9.12%" is a stale July move, not today's.
- The "as of" timestamp shows the newest snapshot across *all* rows, so a week-old row looks current.

## Fix

1. **Restrict "Market moves" to live data**: only include signals with `status = 'open'`, and drop any whose newest snapshot is older than a staleness cutoff (e.g. 24 hours).
2. **Price from the live stream**, not the snapshot: show the streamed last price, and compute the move as `(live − signal_price) / signal_price` — same formula the event cards already use, so both panels agree.
3. **Honest timestamp**: label the panel with the live feed's `updatedAt` and its status ("market closed", "streaming"), instead of the max snapshot time.
4. **Empty state**: if no open signal has a fresh price, say "no fresh moves — market closed / awaiting next refresh" rather than silently showing old rows.
5. Rename the metric label to "move since signal snapshot (open signals only)" so the panel's meaning is unambiguous.

## Technical notes

- `src/components/market-movers.tsx`: filter `listSignals` results to `status === 'open'`, subscribe to `useLiveQuotes` for those symbols (keyed on `quote_symbol || ticker`), compute pct from the live price, and use `statusLabel(...)` from `src/hooks/use-live-quotes.ts` for the header stamp.
- No database or ingestion changes needed — the pipeline is healthy; this is a display-source bug in one component.
