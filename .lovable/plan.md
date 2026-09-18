# Trade Log: totals rows under Open and Closed tables

Add a "Total" row at the bottom of both tables so you can see, without adding up in your head, how much money is in play and how it's doing overall.

## Open trades table — Total row

A footer row (visually distinct — bold, slightly emphasized background) showing:

```text
Total | (blank) | (blank) | N lots | Σ Total cost | (blank) | Σ Market value | Σ Gain/Loss $ | Σ Gain/Loss % | (blank) | (blank)
```

- **Lots** — sum of position sizes.
- **Total cost** — sum of entry × lots across open trades (the money currently committed).
- **Market value** — sum of price-now × lots, counting only trades that have a current price (missing quotes excluded; if any trade lacks a price, a small footnote "1 trade without a current price excluded" appears).
- **Gain/Loss $** — sum of the per-trade unrealised gains/losses.
- **Gain/Loss %** — total gain ÷ total cost × 100 (not an average of the per-trade percentages — a weighted figure reflecting how much you actually put in).
- Gains green / losses red, matching the rows.

## Closed trades table — Total row

Totals respect the active filters (Came from / Instrument / Exit reason / dates), so the row always sums exactly the rows shown above it:

```text
Total (N trades) | (blank) | (blank) | (blank) | (blank) | Σ Total cost | Σ Proceeds | Σ Gain/Loss · % | (blank)
```

- **Total cost** — sum of entry × lots for the filtered closed trades.
- **Proceeds** — sum of exit × lots.
- **Gain/Loss** — sum of realised P&L, with the same "money · %" format as the rows: total gain ÷ total cost × 100.
- Green when the set is net positive, red when net negative.

## Notes

- Display-only — computed in `src/routes/_authenticated/blotter.tsx` (OpenTable and ClosedTable) from figures the page already loads; helpers `positionCost` / `marketValue` in `src/lib/paper-trades.ts` are reused, and short trades already compute correctly through the existing direction-aware maths.
- No data, stats, bridge, or export changes. The Accumulated Results strip and Stats section are untouched.
- When a table is empty, no totals row is shown (tables already have their own empty states).
