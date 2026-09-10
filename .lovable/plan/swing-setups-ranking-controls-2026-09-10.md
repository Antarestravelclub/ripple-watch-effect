# Swing Setups ranking controls

## Goal
Make Swing Setups easy to compare by actual movement, remaining potential, setup quality, risk-adjusted quality, and freshness—without presenting any result as an investment recommendation.

## Changes
- Add a clear **Rank by** control above the setup list with these mutually exclusive choices:
  - Best opportunity (risk-adjusted)
  - Biggest remaining gain to target
  - Highest setup score
  - Highest actual % increase since mapping
  - Highest actual % decrease since mapping
  - Newest event
- Keep the current filters—direction, minimum score, priced-in, conflicted, watchlist, one-per-ticker, and region—and apply ranking after those filters.
- Default to **Best opportunity**, calculated transparently from the existing setup score, remaining move to target, freshness, conflict/priced-in state, and invalidation risk. It will be labelled as a mechanical research ranking, not “best to invest in.”
- Show the relevant comparison percentage on every setup:
  - actual change since mapping;
  - remaining percentage to target;
  - risk-adjusted rank summary where applicable.
- Handle long and short setups correctly: “gain to target” measures favorable movement in the setup direction, while increase/decrease rankings use the stock’s actual signed price change.
- Put setups with missing prices or timestamps below complete results for rankings that require those values.
- Add a short explanation beside the controls so each ranking is understandable, while preserving the existing research-only and no-investment-advice wording.
- Update the Manual’s Setups section to explain every new ranking option and the difference between actual movement, modelled target distance, and risk-adjusted ranking.

## Technical details
- Extend the client-safe setup model with remaining-target percentage, invalidation-risk percentage, event age, and a deterministic composite opportunity rank.
- Keep calculations based only on existing event, signal, quote, and level data; no prediction model or new backend data is required.
- Use a single selector/segmented ranking control rather than independent toggles, preventing contradictory sort modes.
- Verify long/short ordering, missing-data behavior, one-per-ticker behavior, desktop/mobile layout, and the updated Manual.
