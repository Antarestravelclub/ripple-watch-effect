# Finish Bridge Setup Isolation

## Current status

Most of the Bridge Setup request is already implemented:

- `/bridge` exists in the main navigation and is signed-in only.
- It has six numbered, collapsible panels matching the requested setup flow.
- The Python helper and pre-filled `bridge_config.json` downloads are available.
- The downloaded config contains the requested keys and fixed values: `SITE_BASE_URL`, `BRIDGE_SECRET`, `ALLOWED_ACCOUNT`, `EXECUTION_ENABLED: false`, `MAX_LOTS_PER_ORDER: 10.0`, `ACCOUNT_POST_INTERVAL_S: 45`, `DEALS_POST_INTERVAL_S: 60`, and `INSTRUCTION_POLL_INTERVAL_S: 12`.
- A long random per-user bridge secret is generated on first visit, can be revealed, copied, saved with an account number, and regenerated after confirmation.
- Bridge endpoints accept the secret through `x-bridge-key`, `X-Bridge-Secret`, or `Authorization: Bearer`.
- The Live connection panel shows online, stale, or offline status plus demo/live warning, broker/server, masked account, balance, equity, and last update.

## Verified gap

Bridge state is not fully isolated per user yet:

- Snapshots, positions, deals, instructions, mirror settings, and heartbeats are stored and queried globally.
- Their database policies currently allow any signed-in user to read all rows.
- Bridge authentication identifies the secret owner, then discards that owner before writing or reading bridge data.
- An optional workspace-wide `BRIDGE_SECRET` fallback remains in the authentication code and should be removed after the per-user path is verified.

## Remaining work

1. Add an owner column to bridge snapshots, positions, deals, instructions, mirror settings, and heartbeat data.
2. Backfill existing rows to the intended owner where possible; otherwise mark them legacy and stop showing them to users.
3. Return the authenticated bridge owner from bridge authorization and use that owner for every endpoint read, write, claim, and result report.
4. Tighten database policies so each signed-in user can read only their own bridge rows.
5. Scope the Bridge page, Demo Account panel, broker status, and mirroring controls to the signed-in owner.
6. Remove the workspace-wide `BRIDGE_SECRET` fallback once per-user secrets are the only accepted credentials.
7. Update the roadmap and manual wording to reflect the finished per-account behavior.

## Acceptance checks

- A fresh signed-in account receives a unique secret automatically.
- Revealing, copying, saving the account number, downloading config, and regenerating still work.
- A regenerated secret immediately rejects old helper requests with `401`.
- The helper works with each supported authentication header.
- Running the helper changes only that owner's Live connection panel.
- A second signed-in account cannot see the first account's secret, account number, broker state, positions, deals, instructions, or heartbeat.
- Live-account mode still disables mirroring and shows the full-width warning.
- Build passes and `/bridge`, `/blotter`, and `/broker` continue to load.
