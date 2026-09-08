-- 1. Signals: advisor-grade fields
ALTER TABLE public.signals
  ADD COLUMN IF NOT EXISTS conviction_score integer,
  ADD COLUMN IF NOT EXISTS conviction_breakdown jsonb,
  ADD COLUMN IF NOT EXISTS suggested_size_pct numeric,
  ADD COLUMN IF NOT EXISTS atr_at_signal numeric,
  ADD COLUMN IF NOT EXISTS stop_price numeric,
  ADD COLUMN IF NOT EXISTS invalidation_text text,
  ADD COLUMN IF NOT EXISTS invalidation_params jsonb,
  ADD COLUMN IF NOT EXISTS benchmark_symbol text NOT NULL DEFAULT 'SPY',
  ADD COLUMN IF NOT EXISTS benchmark_entry_price numeric,
  ADD COLUMN IF NOT EXISTS benchmark_entry_estimated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS benchmark_exit_price numeric,
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'paper',
  ADD COLUMN IF NOT EXISTS below_threshold boolean NOT NULL DEFAULT false;

ALTER TABLE public.signals
  DROP CONSTRAINT IF EXISTS signals_conviction_score_range;
ALTER TABLE public.signals
  ADD CONSTRAINT signals_conviction_score_range
  CHECK (conviction_score IS NULL OR (conviction_score >= 0 AND conviction_score <= 100));

ALTER TABLE public.signals DROP CONSTRAINT IF EXISTS signals_mode_check;
ALTER TABLE public.signals
  ADD CONSTRAINT signals_mode_check CHECK (mode IN ('paper', 'live'));

ALTER TABLE public.signals DROP CONSTRAINT IF EXISTS signals_status_check;
ALTER TABLE public.signals
  ADD CONSTRAINT signals_status_check
  CHECK (status IN ('open', 'closed', 'stopped', 'invalidated'));

CREATE INDEX IF NOT EXISTS signals_status_idx ON public.signals (status);
CREATE INDEX IF NOT EXISTS signals_conviction_score_idx ON public.signals (conviction_score);

-- 2. Paper portfolio settings (single row)
CREATE TABLE IF NOT EXISTS public.portfolio_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notional_value numeric NOT NULL DEFAULT 100000,
  risk_per_trade_pct numeric NOT NULL DEFAULT 0.5,
  max_position_pct numeric NOT NULL DEFAULT 5,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.portfolio_settings TO anon;
GRANT SELECT ON public.portfolio_settings TO authenticated;
GRANT ALL ON public.portfolio_settings TO service_role;
ALTER TABLE public.portfolio_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Portfolio settings are public" ON public.portfolio_settings;
CREATE POLICY "Portfolio settings are public" ON public.portfolio_settings FOR SELECT USING (true);

DROP TRIGGER IF EXISTS update_portfolio_settings_updated_at ON public.portfolio_settings;
CREATE TRIGGER update_portfolio_settings_updated_at
  BEFORE UPDATE ON public.portfolio_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.portfolio_settings (notional_value, risk_per_trade_pct, max_position_pct)
SELECT 100000, 0.5, 5
WHERE NOT EXISTS (SELECT 1 FROM public.portfolio_settings);

-- 3. Evaluation log: one row per state change
CREATE TABLE IF NOT EXISTS public.signal_evaluation_log (
  id bigserial PRIMARY KEY,
  signal_id uuid NOT NULL REFERENCES public.signals(id) ON DELETE CASCADE,
  trigger text NOT NULL,
  price numeric,
  benchmark_price numeric,
  detail text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.signal_evaluation_log TO anon;
GRANT SELECT ON public.signal_evaluation_log TO authenticated;
GRANT ALL ON public.signal_evaluation_log TO service_role;
ALTER TABLE public.signal_evaluation_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Evaluation log is public" ON public.signal_evaluation_log;
CREATE POLICY "Evaluation log is public" ON public.signal_evaluation_log FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS signal_evaluation_log_signal_idx ON public.signal_evaluation_log (signal_id);
CREATE INDEX IF NOT EXISTS signal_evaluation_log_created_idx ON public.signal_evaluation_log (created_at DESC);