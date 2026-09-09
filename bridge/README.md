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
