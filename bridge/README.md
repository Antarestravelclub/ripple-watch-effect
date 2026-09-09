# Demo account bridge (MetaTrader 5)

The website cannot talk to MetaTrader 5 directly — MT5 has no web API, it only
talks to a terminal running on a machine. So the app publishes orders, and this
small helper, running next to your demo terminal, carries them out.

```
The Ripple Effect  ->  order queue  ->  mt5_bridge.py  ->  MT5 DEMO terminal
                    <-   fills      <-
```

## Safety

- Every queued order is stamped `demo` in the database, and the database refuses
  any other value.
- The helper checks the terminal's account type on startup and **exits** if it is
  not a demo account.
- If a check-in reports a non-demo account, the app refuses to hand out orders.

## What you need

1. A Windows machine (or Windows VM) with MetaTrader 5 installed and logged into
   a **demo** account.

   **On a Mac?** The `MetaTrader5` Python package is Windows-only, so the Mac
   build of MT5 cannot run this helper. Pick one of:
   - a rented Windows VPS from a trading-VPS provider (~10-25 USD/month, always on);
   - Windows in Parallels or VMware on your Mac (only runs while the Mac is awake);
   - any spare Windows PC.
2. Python 3.10 or newer on that machine.
3. The bridge key that was saved in the app.

## Install and run

```bat
pip install MetaTrader5 requests

set RIPPLE_BASE_URL=https://ripple-watch-effect.lovable.app
set RIPPLE_BRIDGE_KEY=your-bridge-key
set RIPPLE_LOT=0.10
python mt5_bridge.py
```

Optional settings:

| Variable | Meaning | Default |
| --- | --- | --- |
| `RIPPLE_POLL_SECONDS` | How often to check for orders | 30 |
| `RIPPLE_LOT` | Fixed lot size per order | 0.10 |
| `RIPPLE_SYMBOL_SUFFIX` | Broker symbol suffix, e.g. `.cash` | none |
| `RIPPLE_MAX_ORDERS` | Orders taken per check | 10 |

Leave the window open. Progress and any rejections are printed there, and also
appear on the app's **Broker** page.

## Symbols

Most MetaTrader brokers offer indices, currencies, metals and a limited list of
share CFDs. Tickers the broker does not carry come back as
`skipped — symbol not available`. Set `RIPPLE_SYMBOL_SUFFIX` if your broker names
shares like `AAPL.cash` or `AAPL-CFD`.

## Which orders get sent

Only signals that scored 55 or higher and have a size, a stop and a target. Each
signal produces at most one opening order and, once the signal resolves, one
closing order.

## Demo account sync + mirroring endpoints (site side)

The helper reports demo-account state and picks up mirror instructions through
these endpoints. All of them require the header `x-bridge-key: $RIPPLE_BRIDGE_KEY`.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/public/bridge/account` | Account snapshot every 30-60s: `account_number`, `account_mode` (`demo`/`live`), `currency`, `balance`, `equity`, `margin`, `free_margin`. |
| POST | `/api/public/bridge/positions` | Full current open-position list: `{ positions: [{ ticket, symbol, direction, lots, open_price, sl, tp, current_price, profit, open_time }] }`. Tickets missing from the list are marked closed. |
| POST | `/api/public/bridge/deals` | Recent closed deals: `{ deals: [{ deal_id, ticket, symbol, direction, lots, open_price, close_price, profit, commission, swap, open_time, close_time }] }`. Insert-if-new on `deal_id`. |
| GET | `/api/public/bridge/instructions?status=pending&limit=10` | Claims pending mirror instructions (marks them `picked_up`). |
| POST | `/api/public/bridge/instructions/{id}/result` | Reports `{ status: "filled", fill_price, fill_time, ticket }` or `{ status: "rejected", detail }`. Idempotent per instruction id. |

Notes:

- A snapshot reporting `account_mode: "live"` cancels all pending instructions
  and disables mirroring in the site UI. The helper must also enforce its own
  demo/account-number allowlist.
- Instructions not picked up within 10 minutes are marked `expired`.
- Instructions only ever carry a broker symbol that was mapped exactly or
  confirmed by hand — guessed suffixes are never executed.

## Helper v2 configuration

| Variable | Meaning |
| --- | --- |
| `SITE_BASE_URL` | Your app address, e.g. `https://ripple-watch-effect.lovable.app`. |
| `BRIDGE_SECRET` | The bridge key saved in the app. Sent as `x-bridge-key` on every request. |
| `ALLOWED_ACCOUNT` | Your DEMO account number. Hard allowlist — any other account is refused. |
| `EXECUTION_ENABLED` | `false` by default. Phase A (reporting) runs with this off. |
| `MAX_LOTS_PER_ORDER` | Local ceiling, default 10, independent of the server limit. |
| `REPORT_SECONDS` / `DEALS_SECONDS` / `INSTRUCTION_SECONDS` | Cycle timings: 30 / 60 / 12 seconds by default. |
| `STATE_DIR` | Where `ripple_ledger.json`, the deal high-water mark and `ripple_bridge.log` are written. |

The helper writes each attempted instruction id to `ripple_ledger.json` **before**
sending the order, so a restart re-posts the stored result instead of placing a
second order. Logs rotate at 2 MB, five files kept.

## Rollout order

1. Run with `EXECUTION_ENABLED=false`. Confirm the Demo Account panel in the
   Blotter fills in, then stop the helper and watch the chip go Stale, then Offline.
2. Check a few tickers map to symbols that exist in your terminal
   (`/admin/broker-symbols`).
3. Set `EXECUTION_ENABLED=true`, mirror one small trade, confirm the fill is
   reported, then close it and confirm the close and deal reconciliation.
4. Test the kill switch (Pause all mirroring) and an unmapped-symbol refusal
   before regular use.

The helper never places pending orders, never modifies stops or targets on
existing positions, and never partially closes.
