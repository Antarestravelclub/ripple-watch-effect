# Make every stock symbol clickable

Right now a symbol is only clickable in a few places, and the little symbol chips on event
cards just add/remove the name from your watchlist. The goal: wherever a symbol appears in the
app, clicking it opens that symbol's own data page.

## What changes

1. **One shared clickable symbol.** A single reusable symbol link is introduced and used
   everywhere, so symbols look and behave the same across the whole app: click the symbol text
   to open its page.

2. **Wired into every place a symbol appears:**
   - Event cards and event detail (tailwind/headwind lists, exposure map)
   - Market moves rows on Today
   - Setups list and setup cards
   - Tracker table
   - Signal detail page
   - Scorecard tables
   - Watchlist and its quote cards
   - Historical Echoes / Analogues reaction tables
   - Ticker search results and the Tickers index
   - Live picks and top-setups strips

3. **Watchlist chips keep both actions.** The chips on event cards become split: the symbol
   text opens the symbol page, and the small +/✓ button still adds or removes it from your
   watchlist. Nothing you can do today is lost.

4. **The symbol page becomes useful for any symbol.** Today it says "No active signals" and
   stops. It will instead always show:
   - current price, day change, day high/low and when that price arrived
   - the live TradingView chart for the symbol
   - net stance (Long / Short / Conflicted) and every active signal with its event, when there
     are signals
   - past signals on the symbol with how they resolved
   - historical reactions for the symbol from the Analogues data
   - an add/remove watchlist button
   - a plain note when there is no exposure mapped, instead of a dead end

5. **Symbols with no tradeable listing** (private companies, foreign lines with no US
   equivalent) still open the page, which explains why no price is available rather than
   showing a broken screen.

## Technical notes

- New `TickerLink` component wrapping `<Link to="/tickers/$symbol" params={{ symbol }}>`; used
  in place of raw `font-mono` symbol text across the components and routes listed above.
- `src/components/ticker-chip.tsx` becomes a link plus a separate watchlist toggle button, so
  the click no longer conflicts with card navigation.
- `src/routes/tickers.$symbol.tsx` is extended: it keeps the rollup lookup but no longer bails
  out when no rollup exists, and additionally reads the stored latest price, the symbol's
  signals (all statuses), and historical reactions for that symbol.
- Display and routing work only — no changes to ingestion, scoring, evaluation, the price
  fetch, or cron schedules.
