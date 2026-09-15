# Trade Log — show time to hit target or stop on closed trades

## What you asked for
In the "Closed — cashed out" section, show how long each trade took to reach its exit (target hit, stop hit, or other reason), at a glance.

## Current state
The closed table already carries the data: each row has a `Reason` column (Target / Stop / Expired / Manual / etc.) and a separate `Duration` column (entry time → exit time). They're just split across two columns, so the "how long did it take to hit TP or SL" answer isn't obvious.

## Plan
- Merge `Reason` and `Duration` into one column in the closed table: exit reason on the first line (e.g. "Target hit", "Stopped out"), with the time it took directly underneath (e.g. "in 2d 4h").
- Rename the column header to "Exit / time in trade" (keeps the table fitting on one page — one column replaces two).
- No data or logic changes: duration is already computed from entry and exit timestamps; exits are stamped when the automatic checks detect the stop/target touch.
- Small print note under the closed table: stop/target times reflect when the automatic price check detected the touch (checks run on live quotes, roughly every 15 minutes), not necessarily the exact tick.

## Technical details
- File: `src/routes/_authenticated/blotter.tsx` (ClosedTable only — open table untouched).
- Remove the standalone `Duration` column; render `{EXIT_REASON_LABEL[...]}` + `fmtDuration(entry_time, exit_time)` stacked in one `<Td>`.
- Manual page wording for the Trade Log section stays accurate (duration now appears with the reason).
- Verify: tsgo clean, build OK, screenshot of the closed section showing reason + time per row.
