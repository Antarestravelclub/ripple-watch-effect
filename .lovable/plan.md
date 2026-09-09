# Connecting your MetaTrader 5 demo account

Goal: get the Broker page showing a live demo account — balance, equity, open positions — and orders actually being placed on that demo account.

## The one hard constraint

MetaTrader 5 has no web API. Orders can only be placed by a small helper program running on the same machine as a logged-in MT5 terminal, and that helper only works on Windows. A Mac cannot run it, even though MT5 itself has a Mac download.

So you need one of these, and it must stay switched on during market hours:

1. A Windows VPS rented from a forex-VPS provider (about 10-25 USD a month, always on, closest to how this is normally done).
2. Parallels or VMware on your Mac running Windows (works, but only while your Mac is awake).
3. Any spare Windows PC at home.

Nothing in the app changes based on which one you pick. The plan below assumes option 1 or 2.

## What I will build

### 1. Save the bridge key
Create the app's bridge key (a long random password) and store it encrypted in the app. The helper is given the same value so the app knows it is your helper and not a stranger. Until this exists, the Broker page correctly says the helper cannot connect.

Because the app can never show a stored secret back to you, I will ask you to paste one value into a secure form, and you keep a copy for the helper.

### 2. Guided setup panel on the Broker page
Add a step-by-step "Connect your demo account" card at the top of `/broker`, replacing the plain paragraph at the bottom:

- A live checklist with a tick or cross per step: bridge key saved, helper has ever checked in, helper checked in within the last 10 minutes, account confirmed demo, broker symbol list uploaded.
- Numbered instructions: open the demo account, install MT5 and Python on the Windows machine, download the helper, run it.
- Copy-to-clipboard blocks for the exact commands, with your app address already filled in and the key shown as a placeholder you paste over.
- A "Waiting for your helper..." state that flips to the account summary the moment the first check-in lands, so you can watch it connect in real time.
- A short note for Mac owners explaining the Windows requirement and the three options above.
- A link to the symbol-mapping page, since most brokers only carry a limited share list.

### 3. Small helper improvements
- Print a clear one-line message on start: connected account, server, demo/live, equity — so the Windows window confirms success at a glance.
- Fail with a plain-English message when the key is missing or wrong, instead of a raw error.
- Keep the existing demo-only guard: the helper exits on a non-demo account, and the app refuses to hand orders to one.

### 4. Manual
Add a "Connect a demo account" section to `/manual` mirroring the on-page steps, so it prints with the rest of the guide.

## Out of scope

No live/funded trading, no change to signals, conviction, sizing or the evaluation schedule. Every order stays stamped demo, and the database rejects anything else.

## Technical notes

- New secret `BRIDGE_SECRET`; helper reads the same value as `RIPPLE_BRIDGE_KEY`.
- Setup panel is a new component rendered by `src/routes/broker.tsx`, driven by the existing `getBrokerActivity` server function plus its `configured` flag and latest heartbeat; add heartbeat freshness and a symbol-upload-present flag to that payload.
- `bridge/mt5_bridge.py` and `bridge/README.md` get the startup summary, clearer auth failure text, and macOS guidance. Existing order-claim, fill-report and mapped-symbol logic unchanged.
