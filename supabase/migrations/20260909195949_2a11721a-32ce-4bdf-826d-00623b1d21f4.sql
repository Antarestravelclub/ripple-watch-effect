ALTER TABLE public.bridge_account_snapshots
  ADD COLUMN IF NOT EXISTS user_id uuid;
CREATE INDEX IF NOT EXISTS bridge_account_snapshots_user_received_idx
  ON public.bridge_account_snapshots (user_id, received_at DESC);

ALTER TABLE public.bridge_positions
  ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.bridge_positions
  DROP CONSTRAINT IF EXISTS bridge_positions_ticket_key;
CREATE UNIQUE INDEX IF NOT EXISTS bridge_positions_user_ticket_key
  ON public.bridge_positions (user_id, ticket);
CREATE INDEX IF NOT EXISTS bridge_positions_user_status_idx
  ON public.bridge_positions (user_id, status);

ALTER TABLE public.bridge_deals
  ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.bridge_deals
  DROP CONSTRAINT IF EXISTS bridge_deals_deal_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS bridge_deals_user_deal_key
  ON public.bridge_deals (user_id, deal_id);
CREATE INDEX IF NOT EXISTS bridge_deals_user_close_time_idx
  ON public.bridge_deals (user_id, close_time DESC);

ALTER TABLE public.bridge_instructions
  ADD COLUMN IF NOT EXISTS user_id uuid;
CREATE INDEX IF NOT EXISTS bridge_instructions_user_status_idx
  ON public.bridge_instructions (user_id, status, created_at DESC);

ALTER TABLE public.bridge_mirror_settings
  ADD COLUMN IF NOT EXISTS user_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS bridge_mirror_settings_user_key
  ON public.bridge_mirror_settings (user_id);

ALTER TABLE public.broker_bridge_heartbeats
  ADD COLUMN IF NOT EXISTS user_id uuid;
CREATE INDEX IF NOT EXISTS broker_bridge_heartbeats_user_seen_idx
  ON public.broker_bridge_heartbeats (user_id, seen_at DESC);
GRANT SELECT ON public.broker_bridge_heartbeats TO authenticated;

ALTER TABLE public.broker_orders
  ADD COLUMN IF NOT EXISTS user_id uuid;
DROP INDEX IF EXISTS public.broker_orders_signal_intent_key;
CREATE UNIQUE INDEX IF NOT EXISTS broker_orders_user_signal_intent_key
  ON public.broker_orders (user_id, signal_id, intent);
CREATE INDEX IF NOT EXISTS broker_orders_user_status_idx
  ON public.broker_orders (user_id, status, created_at DESC);

DROP POLICY IF EXISTS "Signed-in users can view demo account snapshots" ON public.bridge_account_snapshots;
CREATE POLICY "Owners can view their bridge snapshots"
  ON public.bridge_account_snapshots FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Signed-in users can view demo positions" ON public.bridge_positions;
CREATE POLICY "Owners can view their bridge positions"
  ON public.bridge_positions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Signed-in users can view demo deals" ON public.bridge_deals;
CREATE POLICY "Owners can view their bridge deals"
  ON public.bridge_deals FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Signed-in users can view mirror instructions" ON public.bridge_instructions;
CREATE POLICY "Owners can view their bridge instructions"
  ON public.bridge_instructions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Signed-in users can view mirror settings" ON public.bridge_mirror_settings;
CREATE POLICY "Owners can view their bridge settings"
  ON public.bridge_mirror_settings FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "No direct authenticated access to bridge heartbeats" ON public.broker_bridge_heartbeats;
CREATE POLICY "Owners can view their bridge heartbeats"
  ON public.broker_bridge_heartbeats FOR SELECT TO authenticated
  USING (auth.uid() = user_id);