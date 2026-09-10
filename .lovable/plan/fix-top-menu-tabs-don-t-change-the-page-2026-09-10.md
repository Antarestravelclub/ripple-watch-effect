# Fix: top menu tabs don't change the page

## What's actually wrong

Confirmed in the running app: clicking a tab does change the address, but the new page never appears — the old page stays on screen.

The cause is the live price feed. Every price panel and every event card opens its own separate always-open price connection. On the Today page that adds up to **105 open connections at once**, and a browser only allows about 6 per site. Everything else — including the code and data for the page you just clicked — waits in line behind them forever, so the new page can never finish loading.

Opening a page directly by address works fine, which matches this diagnosis.

## The fix

Make the whole app share **one** price connection instead of one per panel.

- Introduce a single shared price-feed subscriber. Panels register the symbols they care about; one connection is opened for the combined list and every panel reads its prices from it.
- When the set of symbols changes (filters, navigation, new events), the shared connection is replaced once, with a short debounce so rapid changes don't churn it.
- Cap the number of symbols streamed at a time (the server already caps at 25) and keep the existing periodic snapshot fetch as the fallback for anything not streamed, so prices still update when the market is closed or the stream is unavailable.
- Reuse the existing hook name so no page needs restructuring: `useLiveQuotes(tickers)` keeps its current return shape (`quotes`, `isLoading`, `status`, `marketOpen`, `streaming`, `updatedAt`, `diagnostics`) but is backed by the shared feed.
- Close the shared connection when no panel is subscribed, and reconnect with backoff on error instead of leaving dead connections open.

Two smaller cleanups seen while investigating:
- A duplicate-key warning on the Today page (repeated ticker `ORCL` in a list) — deduplicate the keys.
- Snapshot polling on top of the stream currently causes overlapping refreshes; dedupe by symbol set.

## Technical notes

- New module `src/hooks/use-live-quotes.ts` internals: a module-level singleton store (subscriber map, symbol reference counts, one `EventSource`, last-known quote cache, status/diagnostics) exposed through `useSyncExternalStore`, with a server snapshot function that returns a stable cached value to avoid the `getServerSnapshot should be cached` warning already logged.
- Server route `src/routes/api/public/stream/quotes.ts` stays unchanged; it already accepts a comma-separated symbol list and caps at 25 with a 4-minute lifetime, so the shared client reconnects on stream end.
- The REST snapshot query (`getQuotes`) moves into the shared store as a single query keyed on the union symbol list, replacing the per-component queries.
- Affected consumers (no behaviour change expected): `market-movers`, `quote-card`, `top-setups-strip`, `event-signals`, `live-picks`, `watchlist-quotes`, `setups`, `tickers.index`, `tickers.$symbol`.

## Verification

- Load the Today page, confirm at most one open price connection and that pending requests drain.
- Click through Setups, Calendar, Analyser, Tracker, Tickers, Scorecard, Analogues, Playbooks, Watchlist, Manual and confirm each page's heading actually changes.
- Confirm prices still tick and the "Live · streaming / Delayed" labels still behave.
