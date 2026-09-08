# Put the world events back into "Market moves"

Right now that panel lists only ticker symbols, prices and percentages, plus a technical
diagnostics box. The world-event context that explains *why* each name is moving is not
shown there — the event stories still live in the feed further down the page ("Today's
Ripples"), which is why it feels like the information disappeared.

## What changes

1. **Rename the panel** to "Market moves — driven by today's events" so its purpose is clear.

2. **Every row gains its event.** Each increase/drop line will show, under the ticker:
   - the headline of the world event that produced that signal,
   - the event category and region chips,
   - how long ago the event happened,
   - whether the exposure was mapped as tailwind or headwind for that name.
   Clicking the row still opens the signal; clicking the headline opens the event story.

3. **Group by event where it helps.** When several movers come from the same event, they are
   shown together under that headline, so the panel reads as "this happened → these names moved".

4. **Move the technical readout out of the way.** The feed-diagnostics grid (source, requests,
   rate limits) collapses behind a small "Feed status" link and only expands on click, or shows
   itself automatically when the price feed is failing. Nothing is removed.

5. **Clearer empty state.** When no fresh moves exist, the panel names the reason in plain
   language and points to the newest events instead of showing a blank list.

6. Disclaimers stay exactly as they are: observed movement only, delayed prices, not advice.

## Technical notes

- Display-only work. No change to ingestion, signal generation, evaluation, price fetching,
  cron schedules or the `latest_prices` store.
- Files touched: `src/components/market-movers.tsx` (rewrite of the row/grouping layout and a
  collapsible diagnostics block).
- The event link for each mover comes from joining the signal's `event_id` to the live-events
  data already loaded on the page (`useLiveEvents`), so no new queries are needed; movers whose
  event has aged out of the feed simply render without the headline.
