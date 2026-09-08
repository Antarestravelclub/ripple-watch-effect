CREATE TABLE public.latest_prices (
  symbol text PRIMARY KEY,
  price numeric NOT NULL,
  day_high numeric,
  day_low numeric,
  prev_close numeric,
  quote_time timestamptz,
  fetch_time timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'yahoo-spark',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.latest_prices TO anon;
GRANT SELECT ON public.latest_prices TO authenticated;
GRANT ALL ON public.latest_prices TO service_role;
ALTER TABLE public.latest_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Latest prices are public" ON public.latest_prices FOR SELECT USING (true);
CREATE TRIGGER update_latest_prices_updated_at BEFORE UPDATE ON public.latest_prices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.price_fetch_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finished_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'yahoo-spark',
  symbols_requested integer NOT NULL DEFAULT 0,
  requests_made integer NOT NULL DEFAULT 0,
  rate_limited integer NOT NULL DEFAULT 0,
  succeeded integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  ok boolean NOT NULL DEFAULT true,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.price_fetch_runs TO anon;
GRANT SELECT ON public.price_fetch_runs TO authenticated;
GRANT ALL ON public.price_fetch_runs TO service_role;
ALTER TABLE public.price_fetch_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Price fetch runs are public" ON public.price_fetch_runs FOR SELECT USING (true);
CREATE INDEX price_fetch_runs_finished_at_idx ON public.price_fetch_runs (finished_at DESC);