# Ripple Bridge Helper (MetaTrader 5 demo)

Connects a local MetaTrader 5 terminal running an **XM demo account** to The
Ripple Effect site.

```
The Ripple Effect  ->  bridge endpoints  ->  ripple_bridge_helper.py  ->  MT5 DEMO terminal
```

- **Phase A (always on):** reports account balance/equity, open positions and
  closed deals to the site every 30–60 seconds. The **Demo Account** panel on
  the Broker page and the Blotter show this data.
- **Phase B (`EXECUTION_ENABLED=true`):** polls the site for mirror
  instructions every ~12 seconds and places **demo-only** market orders,
  reporting each fill or rejection back.

## Safety model (defense in depth)

- Hard account allowlist (`ALLOWED_ACCOUNT`), checked at startup **and** on
  every execution cycle.
- All execution is refused if the terminal reports anything but a demo account.
  Any non-demo mode is reported to the site as `live`, which also cancels all
  pending instructions server-side.
- A disk-persisted ledger (`instruction_ledger.json`) records every instruction
  id **before** the order is sent — a crash or restart can never double-place.
- Executes exactly the broker symbol the site resolved, or rejects. No symbol
  invention, no pending/limit orders, no partial closes, no SL/TP edits.
- The helper never reads prices from the site; MT5 is the source of truth for
  account state.

## Requirements

1. A Windows machine (or Windows VM/VPS) with MetaTrader 5 installed and logged
   into your **XM demo** account. The MetaTrader5 Python package only works on
   Windows — on a Mac, use a Windows VPS or a VM (Parallels/VMware).
2. Python 3.10 or newer on that machine.
3. The bridge key that was saved in the app (stored server-side as
   `BRIDGE_SECRET`).

## Install and run

```bat
pip install MetaTrader5 requests
copy bridge_config.example.json bridge_config.json
```

Edit `bridge_config.json`:

| Key | Meaning |
| --- | --- |
| `SITE_BASE_URL` | Full site URL, e.g. `https://ripple-watch-effect.lovable.app` |
| `BRIDGE_SECRET` | The same long random value saved in the app as the bridge secret |
| `ALLOWED_ACCOUNT` | Your XM **demo** account number (integer) |
| `EXECUTION_ENABLED` | `false` = reporting only; `true` = also place mirror orders |
| `MAX_LOTS_PER_ORDER` | Local ceiling per order (default 10), independent of the site's limit |

Then:

```bat
python ripple_bridge_helper.py
```

Leave the window open. Progress, every post, every order attempt and every
safety refusal are printed there and written to a rotating log file
(`bridge_helper.log`, 5 MB × 5 backups) — the first place to look when
something goes wrong on the site.

## Endpoints used (all under `/api/public/bridge/`, header `x-bridge-key`)

| Endpoint | Direction | Purpose |
| --- | --- | --- |
| `POST /account` | helper → site | Account snapshot (balance, equity, margin, mode) |
| `POST /positions` | helper → site | Full open-position list every cycle (server diffs) |
| `POST /deals` | helper → site | Closed deals since last post (server dedupes by deal id) |
| `GET /instructions?status=pending` | site → helper | Pending mirror instructions (marked picked-up on read) |
| `POST /instructions/{id}/result` | helper → site | Fill or rejection for one instruction (idempotent) |

## Rollout order

1. Run with `EXECUTION_ENABLED=false`. Confirm the Demo Account panel populates
   and the status chip shows Connected. Stop the helper and watch it go
   Stale → Offline.
2. Verify symbol mappings for a few tickers (site resolves → symbol exists in
   the terminal) via the admin broker-symbols page.
3. Set `EXECUTION_ENABLED=true`, mirror one small trade, verify the fill is
   reported, then close it and verify the close + deal reconciliation.
4. Test the site's kill switch (Pause all mirroring) and an unmapped-symbol
   refusal before regular use.

## Failure behavior

- Any HTTP failure is logged and retried with the loop's normal cadence; the
  helper never crashes the loop.
- Deals use a persisted high-water mark (`deals_highwater.json`) with a 5-minute
  overlap; re-sends are harmless because the server dedupes by deal id.
- If the helper crashes after writing an instruction to the ledger but before
  recording a result, it refuses to re-place and reports
  `ambiguous_prior_attempt` — check MT5 for the `ripple:<id>` comment manually.
