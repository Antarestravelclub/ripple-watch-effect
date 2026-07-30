# Live Quotes: Reliability, Speed, Coverage

Three things: make quotes actually show up, make them stream instead of poll, and cover more symbols.

## 1. Fix "n/a" / stale quotes

- Add a diagnostics path to the quote server functions: return a status (`ok`, `no_key`, `rate_limited`, `unsupported_symbol`, `market_closed`) instead of silently returning `null`, so the UI can say why a price is missing.
- Today the Finnhub helper swallows every failure (`catch { return null }`) and treats `price === 0` as "no quote" — both look identical to a user. Surface them separately.
- Show a small status line ("delayed · updated 13:04:22" / "rate limited, retrying") on the quote card, live picks strip, watchlist quotes, and market movers.
- Batch quote lookups so a card with 6 tickers issues one server call, reducing rate-limit hits on the free tier.

## 2. Real-time streaming instead of 60s polling

- Add a Finnhub WebSocket bridge: a server route at `/api/public/stream/quotes` that opens the upstream trade socket with the server-side key and relays trades to the browser as Server-Sent Events, subscribed to the tickers the page needs.
- New `useLiveQuotes(tickers)` hook: seeds from the existing REST snapshot, then applies streamed trade prices in place, recomputing % change against previous close.
- Prices tick within a second while the market is open; automatic fallback to the current 60s polling when the socket drops or the market is closed.
- Flash teal/amber briefly on each price change so movement is visible.

## 3. Broader symbol coverage

- Remove the US-only restriction in symbol search so Australian, Canadian, European, Japanese and Chinese listings can be looked up (matching the app's region filters), with the exchange shown next to each match.
- Add a second data source as fallback when Finnhub returns nothing for a symbol (non-US names on the free tier), so the quote card shows a price instead of "No live quote".
- Quote card gains currency display, since non-US symbols aren't in USD.

## Technical notes

- SSE route lives under `src/routes/api/public/stream/quotes.ts`; the API key never leaves the server, and the route accepts only a symbol list.
- Streaming state is kept in a React hook writing into the existing TanStack Query cache keys, so every component already using `getQuotes` benefits without rewrites.
- Fallback provider is called only on a Finnhub miss, keeping request volume low.
- Market-hours detection gates the socket so we don't hold an idle connection overnight.

## Question left open

The fallback provider for non-US symbols may need its own free API key. If you'd rather stay Finnhub-only, I'll skip item 3's fallback and just widen the exchange search.
