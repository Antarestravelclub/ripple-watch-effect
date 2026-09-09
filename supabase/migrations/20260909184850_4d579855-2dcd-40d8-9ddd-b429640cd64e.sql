CREATE TABLE public.paper_account_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  starting_balance numeric NOT NULL DEFAULT 1000 CHECK (starting_balance > 0),
  risk_per_trade_pct numeric NOT NULL DEFAULT 0.5 CHECK (risk_per_trade_pct > 0 AND risk_per_trade_pct <= 100),
  max_position_pct numeric NOT NULL DEFAULT 5 CHECK (max_position_pct > 0 AND max_position_pct <= 100),
  default_min_lot numeric NOT NULL DEFAULT 1 CHECK (default_min_lot > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.paper_account_settings TO authenticated;
GRANT ALL ON public.paper_account_settings TO service_role;

ALTER TABLE public.paper_account_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own paper account settings"
  ON public.paper_account_settings FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER paper_account_settings_updated_at
  BEFORE UPDATE ON public.paper_account_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.broker_symbols
  ADD COLUMN IF NOT EXISTS volume_min numeric,
  ADD COLUMN IF NOT EXISTS volume_step numeric,
  ADD COLUMN IF NOT EXISTS contract_size numeric;