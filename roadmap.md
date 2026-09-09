# Roadmap

## Done
- Guided "Connect your demo account" panel on /broker, Mac/Windows guidance, helper startup + auth error messages, manual section.

## Open
- BRIDGE_SECRET must be saved by the user (secure form) — blocked on user input.

## Phase A — Demo Sync (done)
- [x] Tables: bridge_account_snapshots, bridge_positions, bridge_deals
- [x] Endpoints: POST /bridge/account, /bridge/positions, /bridge/deals (bridge-secret auth)
- [x] Demo Account panel in Blotter: account header (masked), status chip Connected/Stale/Offline, open positions, collapsible closed deals
- [x] Red banner + disable mirroring if account_mode = live

## Phase B — Mirror to Demo (done, awaiting helper)
- [x] Tables: bridge_instructions; paper_trades adds mirrored, mirror_ticket, demo_fill_price, demo_close_price, demo_realized_pnl
- [x] Endpoints: GET /bridge/instructions?status=pending, POST /bridge/instructions/{id}/result (idempotent)
- [x] Instruction creation rules (connected, demo, exact mapping only, tradable, kill switch off, lots <= 10)
- [x] Close instructions on manual + cron closes; reconcile via deals
- [x] Stats: entry/exit slippage signed, per symbol, rejected/expired counts
- [x] Kill switch (server-side state), instructions log view
- [x] Cron expires stale instructions

## Windows bridge helper (spec v2)
- [x] Config: SITE_BASE_URL, BRIDGE_SECRET, ALLOWED_ACCOUNT, EXECUTION_ENABLED (default false), MAX_LOTS_PER_ORDER
- [x] Startup allowlist + demo check; post one snapshot then refuse execution on mismatch
- [x] Reporting loop: account/positions 30-60s, deals 60s with local high-water mark, backoff on failure
- [x] Execution loop 10-15s: per-cycle re-check, symbol exists, volume min/max/step, disk ledger idempotency
- [x] Close by ticket; already-closed reports filled from history
- [x] Report every outcome with retry/backoff; rotating local log

## Accumulated Results (Blotter footer)
- [x] Persistent summary below the tables: realized $/% of notional, unrealized, combined
- [x] Counts, win rate, avg win/loss ($ and R), expectancy, best/worst, paper equity
- [x] Demo realized row when mirrored trades exist (slippage gap)
- [x] Respects closed-trade filters, stale-feed warning on unrealized, muted n = X

## Configurable starting balance (done)
- [x] Per-user paper_account_settings: starting_balance (default $1,000), risk %, max position %, default min lot
- [x] Sizing, P&L %, equity curve and Blotter stats all compute from it
- [x] Starting balance card on the Blotter
- [x] Broker uploads store volume_min / volume_step / contract_size when present
- [x] "Undersized at this balance" notice with min-lot size, its $ and % risk, take-at-min-lot or skip
