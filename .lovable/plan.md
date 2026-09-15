# Trade Log: add cost / value / gain columns

Add position-value columns to the Trade Log so every open trade shows what you paid, what it's worth now, and the gain or loss in both dollars and percent — all fitting on one page without sideways scrolling.

## Open trades table — new columns

Today: Symbol, Dir, Entry, Lots, Current, To target, Unrealised, To stop, In trade, actions.

After (11 columns):

```text
Symbol | Dir | Cost/share | Lots | Total cost | Price now | Market value | Gain/Loss $ | Gain/Loss % | To target / stop | actions
```

- **Cost/share** — the current "Entry" column, renamed so it reads as what you paid per share.
- **Total cost** — cost/share × lots (the money you put in).
- **Price now** — the current "Current" column, renamed.
- **Market value** — price now × lots (what the position is worth today).
- **Gain/Loss $** — market value − total cost, direction-aware for shorts (green when winning, red when losing).
- **Gain/Loss %** — the same move as a percentage of total cost.
- **To target / stop** — today's two separate columns merged into one compact two-line cell (target on top, stop below), each with its distance.
- "In trade" duration folds into a small line under the symbol, and the duplicated "N lots" line under Unrealised goes away (Lots has its own column). These consolidations are what makes the new columns fit on one screen; the table also keeps its existing horizontal-scroll fallback on very narrow windows.

No data changes needed — every figure derives from fields the page already loads (entry price, lots, live price, direction).

## Closed trades table

Closed trades already show the final realised profit or loss per row. Add **Total cost** (entry × lots) and **Proceeds** (exit × lots) columns there too, so cashed-out trades read the same way. No "market value" on closed rows — the trade no longer has one.

## Technical notes

- All changes are in `src/routes/_authenticated/blotter.tsx` (OpenTable and ClosedTable) plus small helpers in `src/lib/paper-trades.ts` (`positionCost`, `marketValue` — both short-aware via the existing `pnlFor` maths for shorts).
- Unchanged: live prices, automatic stop/target exits, stats, demo mirroring, the bridge — this is display-only.
