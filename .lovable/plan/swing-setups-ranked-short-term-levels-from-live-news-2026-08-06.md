# Swing Setups — ranked short-term levels from live news

Goal: one screen that answers "which tickers from today's news have the cleanest short-term swing, and at what levels would I get in and out?" — expressed as mechanical scenario levels (entry zone, target, exit), never as advice.

## What gets built

A new page, **Swing Setups** (`/setups`), linked in the main nav.

Each row is one ticker tied to one live event, showing:

- Ticker, company, event headline, and direction (Tailwind long / Headwind short)
- **Setup score** (0–100) so the list is ranked best-first
- **Entry zone** — a price band around the current quote, not a single number
- **Target** — the expected-move level from the event's ripple magnitude (High 4%, Medium 2%, Low 1%)
- **Exit / invalidation** — the level where the thesis is treated as wrong (half the expected move against you)
- **Reward : risk** ratio (always ~2:1 by construction, shown explicitly)
- **Expected window** — trading days remaining out of the 10-day expiry
- Mechanism sentence (why the news touches this ticker)
- Warning chips already in the app: "move likely captured" (priced-in), "conflicted" (same ticker long and short across events), "no price data", low-liquidity/ADR proxy

Filters: region, direction, minimum score, watchlist-only, hide priced-in, hide conflicted.

Detail: each row links to the existing signal and ticker pages for the sparkline and history.

## How the score is built

Ranked from data already in the app — no new prediction model:

1. Event freshness (hours since publish; a fresh event scores far above a 3-day-old one)
2. Ripple magnitude (High > Medium > Low)
3. Exposure confidence from the AI mapping (High / Medium / Low)
4. Un-captured move: how much of the expected move is still left vs. already moved since the snapshot
5. Directional agreement: penalise tickers whose net stance is Conflicted across events
6. Data quality: penalise missing/stale quotes and non-US proxy symbols

Score, entry band, and levels are all derived client-side from the live event feed, tracked signals, and live quotes — so the page updates on the same 15-minute ingest and live-quote refresh as the rest of the app.

## Positioning and disclaimers

The wording stays research-grade: "setup", "levels", "scenario", "exposure" — no "buy", "sell", or "recommendation". Every setup card carries a line that these are mechanical levels derived from event magnitude, not price predictions, and the existing footer disclaimer plus the liquidity/borrow warning remain on the page.

## Technical notes

- `src/lib/swing-setups.ts` — pure module: score, entry band, reward:risk, window-remaining. Reuses `signal-levels.ts` (`levelsFor`, `EXPIRY_TRADING_DAYS`, `tradingDaysBetween`), `event-freshness.ts`, `ticker-rollup.ts`, and `ticker-registry.ts`.
- `src/routes/setups.tsx` — new route with its own `head()` metadata; consumes `useLiveEvents`, the existing signals server function, and `use-live-quotes`.
- `src/components/setup-card.tsx` — one setup row/card, responsive (table-like on desktop, stacked cards on mobile).
- Nav entry added in `src/components/site-shell.tsx`; a "Top setups" strip on the home feed links here.
- No schema changes, no new secrets, no new ingestion work.
