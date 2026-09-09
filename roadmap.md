# Roadmap

## Done
- Guided "Connect your demo account" panel on /broker, Mac/Windows guidance, helper startup + auth error messages, manual section.

## Open
- BRIDGE_SECRET must be saved by the user (secure form) — blocked on user input.

## Phase A — Demo Sync
- [ ] Tables: bridge_account_snapshots, bridge_positions, bridge_deals
- [ ] Endpoints: POST /bridge/account, /bridge/positions, /bridge/deals (bridge-secret auth)
- [ ] Demo Account panel in Blotter: account header (masked), status chip Connected/Stale/Offline, open positions, collapsible closed deals
- [ ] Red banner + disable mirroring if account_mode = live

## Phase B — Mirror to Demo
- [ ] Tables: bridge_instructions; paper_trades adds mirrored, mirror_ticket, demo_fill_price, demo_close_price, demo_realized_pnl
- [ ] Endpoints: GET /bridge/instructions?status=pending, POST /bridge/instructions/{id}/result (idempotent)
- [ ] Instruction creation rules (connected, demo, exact mapping only, tradable, kill switch off, lots <= 10)
- [ ] Close instructions on manual + cron closes; reconcile via deals
- [ ] Stats: entry/exit slippage signed, per symbol, rejected/expired counts
- [ ] Kill switch (server-side state), instructions log view
- [ ] Cron expires stale instructions
