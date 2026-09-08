# Bridge Secret Setup Plan

## Goal
Create the shared `BRIDGE_SECRET` that authenticates The Ripple Effect's hosted backend against the local Windows MT5 bridge helper, then verify the bridge endpoints recognize the configuration.

## Steps
1. Open the secure `add_secret` form for `BRIDGE_SECRET` so the user can enter (or generate and paste) a long random value.
2. After the secret is saved, call the bridge endpoints to confirm they no longer return "Bridge is not configured yet" and instead accept authenticated requests.
3. Update the user with the exact environment variable to set in `bridge/mt5_bridge.py` (Windows: `RIPPLE_BRIDGE_KEY`) and point them to `bridge/README.md` for the rest of the setup.

## Guardrails
- The secret must be a new, app-specific value; it cannot reuse a secret from another project.
- The bridge remains demo-only: the server and helper both reject non-demo MT5 accounts.
- No UI control enables live trading; `mode='demo'` is enforced in data and code.

## Verification
- `POST /api/public/bridge/orders` without `x-bridge-key` returns 401.
- `POST` with the correct `x-bridge-key` returns a valid demo-order payload (or empty queue).
- `POST /api/public/bridge/fills` with the correct key accepts a fill report.
