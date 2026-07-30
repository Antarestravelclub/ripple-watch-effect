# Logo + Real Stock Symbol Lookup

## 1. Use the uploaded artwork as the logo

- Upload `IMG_9566.jpeg` to CDN assets and reference it from a rewritten `RippleLogo`: the mark image on the left, "Market Ripple Effect" wordmark handled by the image itself (crop-free, height-constrained ~32px in the header).
- Keep the animated ripple as a subtle fallback only if the image fails to load.
- Set it as the favicon (`public/favicon.png`) and update the icon link in `src/routes/__root.tsx`; delete the default `public/favicon.ico`.

## 2. Stock symbol lookup with live data

Today the search box only filters mock events — it never queries market data. Replace it with a real lookup.

- New server function `lookupSymbol` (`src/lib/quotes.functions.ts`) using the existing `FINNHUB_API_KEY`:
  - `/search?q=` for symbol/company autocomplete
  - `/quote` for current price, change, % change, day high/low, previous close
  - `/stock/profile2` for company name, exchange, industry, logo
- Upgrade `TickerSearch` to a combobox: typing queries Finnhub (debounced) and shows matching symbols with company names, alongside the existing in-app event/sector matches.
- Selecting a symbol shows a **Quote card** on the home page: price, day change with teal/amber colouring, day range, previous close, company/industry, "delayed data" note, plus an Add-to-watchlist button and any Ripple events/signals touching that ticker.
- Watchlist page: show a live quote row per tracked ticker using the same server function.

## Guardrails

- All quote panels carry the existing delayed-price and "not advice" captions.
- API key stays server-side; the browser only calls the server function.

## Technical notes

- Finnhub calls live in `.handler()` of a `createServerFn` (never client-side), cached via React Query with a 60s `staleTime`.
- Free-tier Finnhub covers US symbols; non-US tickers may return empty quotes — the UI shows "No live quote for this symbol" rather than an error.
