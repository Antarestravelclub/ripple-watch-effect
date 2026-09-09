# Broker Symbol Upload & Mapping Plan

## Goal
Let an admin upload the broker symbol dump from the MT5 `DumpSymbols.mq5` script, store it in the database, auto-map broker symbols to app tickers with normalization rules, and surface unmapped symbols for manual review. The bridge helper then uses the server-side mapping first and falls back to its existing suffix logic.

## Out of scope
- Does not change live event ingestion, signal scoring, pricing, or evaluation.
- Does not enable live trading; bridge remains demo-only.

## Technical details

### 1. Database schema
- Create `broker_symbol_uploads` table: id, filename, source, symbol_count, mapped_count, unmapped_count, created_by, created_at, updated_at.
- Create `broker_symbols` table: id, upload_id, broker_symbol, description, path, currency_profit, trade_mode, normalized_base, mapped_app_ticker, mapping_status (`auto_mapped`, `manual_mapped`, `ignored`, `unmapped`), created_at, updated_at.
- Both tables are service-role/admin-only: GRANT ALL to service_role; authenticated users get no direct access (all writes go through admin server functions).
- Add `user_roles` table and `app_role` enum so the admin screen can be gated to admins. Seed the first admin via a secure server function or migration insert (to be decided with the user).

### 2. CSV upload and normalization
- Add a secured server function `uploadBrokerSymbols` that accepts a CSV string, parses rows, inserts into `broker_symbol_uploads` and `broker_symbols`.
- Normalization rules:
  - Strip known suffixes: `.US`, `.cash`, `-CFD`, etc.
  - Case-insensitive match against app ticker base names.
  - Prefer `trade_mode = 'full'` symbols when multiple broker rows match one app ticker.
  - Mark ambiguous or unmatched rows as `unmapped`.
- Return summary counts and a sample of unmapped symbols.

### 3. Admin UI
- New route `/admin/broker-symbols` (or admin section on `/broker`) visible only to admins.
- Upload dropzone/textarea for the CSV.
- Summary cards: total uploaded, auto-mapped, unmapped.
- Unmapped list with inline mapping controls (select app ticker or mark ignored).
- Search/filter by broker symbol, description, or path.

### 4. Bridge integration
- Extend `broker_orders` with optional `broker_symbol` populated from the mapping table at queue time.
- Update `bridge/mt5_bridge.py`:
  - When claiming orders, if `broker_symbol` is present, use it directly.
  - Fall back to `RIPPLE_SYMBOL_SUFFIX` + base ticker resolution only when no server mapping exists.
  - Report `broker_symbol` back in fill reports.
- Update `src/lib/broker-queue.server.ts` to look up the best mapped broker symbol when queueing orders.

### 5. Security
- Upload endpoint requires admin role (server-side check with `supabaseAdmin` reading `user_roles`).
- No anonymous uploads.
- Bridge endpoints continue to require `BRIDGE_SECRET`.

### 6. Verification
- After build: upload a sample CSV, confirm auto-mapping counts, verify unmapped drill-down, and confirm `broker_orders` rows carry the mapped broker symbol.
- Test the bridge helper resolves a mapped symbol directly without suffix guessing.

## Open decision
How should the first admin be created? Options:
- A one-time server function that promotes the current signed-in user to admin.
- A migration insert of a specific user UUID (requires the user to provide it).
- A hardcoded admin email check (not recommended).

## Dependencies on prior work
- `BRIDGE_SECRET` must still be saved before the bridge helper can authenticate; this feature does not unblock that.
