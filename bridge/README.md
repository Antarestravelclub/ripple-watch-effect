# Ripple Bridge Helper — Setup & Run (Windows)

## What this is

A Python program that runs on the same Windows machine as your MT5 terminal.

- **Phase A (default):** every ~45s it reports your demo account's balance/equity, open positions, and closed deals to the Ripple site. Read-only — it cannot trade.
- **Phase B (opt-in):** when you set `EXECUTION_ENABLED` to `true`, it also polls the site for "mirror to demo" instructions and places those orders on the demo account.

## One-time setup

1. Install Python 3.10+ from [python.org](https://www.python.org) (tick **"Add Python to PATH"** during install).

2. Open Command Prompt in the folder where you put these files and run:

```bat
pip install MetaTrader5 requests
```

3. Copy `bridge_config.example.json` to `bridge_config.json` and edit it:

| Key | Meaning |
| --- | --- |
| `SITE_BASE_URL` | Your site URL, e.g. `https://ripple-watch-effect.lovable.app` |
| `BRIDGE_SECRET` | The same bridge secret the site has (exact match, no spaces) |
| `ALLOWED_ACCOUNT` | Your XM demo account number (the login number shown in MT5) |
| `EXECUTION_ENABLED` | `false` for now |

4. Make sure the MT5 terminal is running and logged into the demo account, and that **Tools → Options → Expert Advisors → "Allow algorithmic trading"** is ticked (needed later for Phase B; harmless now).

## Run it

```bat
python ripple_bridge_helper.py
```

Leave the window open. You should see log lines in the console (also written to `bridge_helper.log`). Within a minute the site's Demo Account panel should populate and the status chip should show **Connected**.

To stop: **Ctrl+C**.

## Verifying Phase A

- Site shows balance/equity matching MT5 → good.
- Close the helper → within ~10 minutes the site chip goes **Stale** then **Offline** → good.
- Open a manual trade in MT5 → it appears in the site's positions table on the next cycle.

## Turning on Phase B (only after Phase A is verified)

1. In `bridge_config.json`, set `"EXECUTION_ENABLED": true` and restart the helper.
2. The startup log must say the safety check passed — if the connected account doesn't match `ALLOWED_ACCOUNT` or isn't a demo account, execution stays disabled no matter what the config says.
3. Mirror one small trade from the site, watch it appear in MT5 with a comment like `ripple:xxxxxxxx`, and confirm the fill shows up back on the site.
4. Test the site's kill switch before regular use.

## Files it creates

- `bridge_helper.log` — rotating log; first place to look when anything is odd
- `instruction_ledger.json` — record of every instruction attempted (do not delete; this is what prevents double-placed orders after a crash/restart)
- `deals_highwater.json` — bookmark of the last closed deal reported

## Safety notes

- The helper refuses to trade on any account other than the one in `ALLOWED_ACCOUNT`, and refuses entirely if the terminal reports a real (non-demo) account — checked at startup and on every execution cycle.
- If it ever logs `ambiguous_prior_attempt`, it crashed mid-order once: check MT5 for a position with the matching `ripple:` comment before doing anything else.

## Auto-start on boot (optional, later)

Windows Task Scheduler → run `python C:\path\to\ripple_bridge_helper.py` at logon.
