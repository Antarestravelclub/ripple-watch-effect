CREATE TABLE public.bridge_account_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  received_at timestamptz NOT NULL DEFAULT now(),
  account_number text NOT NULL,
  account_mode text NOT NULL CHECK (account_mode IN ('demo','live')),
  currency text,
  balance numeric,
  equity numeric,
  margin numeric,
  free_margin numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bridge_account_snapshots_received_idx ON public.bridge_account_snapshots (received_at DESC);
GRANT SELECT ON public.bridge_account_snapshots TO authenticated;
GRANT ALL ON public.bridge_account_snapshots TO service_role;
ALTER TABLE public.bridge_account_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users can view demo account snapshots" ON public.bridge_account_snapshots FOR SELECT TO authenticated USING (true);

CREATE TABLE public.bridge_positions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket bigint NOT NULL UNIQUE,
  symbol text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('long','short')),
  lots numeric,
  open_price numeric,
  sl numeric,
  tp numeric,
  current_price numeric,
  profit numeric,
  open_time timestamptz,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bridge_positions_status_idx ON public.bridge_positions (status);
GRANT SELECT ON public.bridge_positions TO authenticated;
GRANT ALL ON public.bridge_positions TO service_role;
ALTER TABLE public.bridge_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users can view demo positions" ON public.bridge_positions FOR SELECT TO authenticated USING (true);
CREATE TRIGGER update_bridge_positions_updated_at BEFORE UPDATE ON public.bridge_positions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.bridge_deals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id bigint NOT NULL UNIQUE,
  ticket bigint,
  symbol text NOT NULL,
  direction text CHECK (direction IN ('long','short')),
  lots numeric,
  open_price numeric,
  close_price numeric,
  profit numeric,
  commission numeric,
  swap numeric,
  open_time timestamptz,
  close_time timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bridge_deals_ticket_idx ON public.bridge_deals (ticket);
CREATE INDEX bridge_deals_close_time_idx ON public.bridge_deals (close_time DESC);
GRANT SELECT ON public.bridge_deals TO authenticated;
GRANT ALL ON public.bridge_deals TO service_role;
ALTER TABLE public.bridge_deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users can view demo deals" ON public.bridge_deals FOR SELECT TO authenticated USING (true);

CREATE TABLE public.bridge_instructions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  paper_trade_id uuid REFERENCES public.paper_trades(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('open','close')),
  broker_symbol text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('long','short')),
  lots numeric,
  sl numeric,
  tp numeric,
  ticket bigint,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','picked_up','filled','rejected','cancelled','expired')),
  status_detail text,
  fill_price numeric,
  fill_time timestamptz,
  filled_ticket bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  picked_up_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bridge_instructions_status_idx ON public.bridge_instructions (status, created_at DESC);
CREATE INDEX bridge_instructions_paper_trade_idx ON public.bridge_instructions (paper_trade_id);
GRANT SELECT ON public.bridge_instructions TO authenticated;
GRANT ALL ON public.bridge_instructions TO service_role;
ALTER TABLE public.bridge_instructions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users can view mirror instructions" ON public.bridge_instructions FOR SELECT TO authenticated USING (true);
CREATE TRIGGER update_bridge_instructions_updated_at BEFORE UPDATE ON public.bridge_instructions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.bridge_mirror_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mirroring_paused boolean NOT NULL DEFAULT true,
  max_lots_per_trade numeric NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bridge_mirror_settings TO authenticated;
GRANT ALL ON public.bridge_mirror_settings TO service_role;
ALTER TABLE public.bridge_mirror_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users can view mirror settings" ON public.bridge_mirror_settings FOR SELECT TO authenticated USING (true);
CREATE TRIGGER update_bridge_mirror_settings_updated_at BEFORE UPDATE ON public.bridge_mirror_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
INSERT INTO public.bridge_mirror_settings (mirroring_paused, max_lots_per_trade) VALUES (true, 10);

ALTER TABLE public.paper_trades
  ADD COLUMN mirrored boolean NOT NULL DEFAULT false,
  ADD COLUMN mirror_ticket bigint,
  ADD COLUMN demo_fill_price numeric,
  ADD COLUMN demo_close_price numeric,
  ADD COLUMN demo_realized_pnl numeric;