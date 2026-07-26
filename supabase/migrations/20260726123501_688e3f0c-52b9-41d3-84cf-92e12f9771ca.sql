
-- Signals table
CREATE TABLE public.signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL,
  ticker text NOT NULL,
  company_name text,
  exchange text,
  direction text NOT NULL CHECK (direction IN ('long','short')),
  conviction smallint NOT NULL DEFAULT 3 CHECK (conviction BETWEEN 1 AND 5),
  rationale text,
  signal_price numeric,
  signal_timestamp timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  target_price numeric,
  invalidation_price numeric,
  closed_price numeric,
  closed_at timestamptz,
  close_reason text,
  generated_by text NOT NULL DEFAULT 'ripple-v1',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, ticker, direction, generated_by)
);

CREATE INDEX signals_event_id_idx ON public.signals(event_id);
CREATE INDEX signals_ticker_idx ON public.signals(ticker);
CREATE INDEX signals_status_idx ON public.signals(status);

GRANT SELECT ON public.signals TO anon, authenticated;
GRANT ALL ON public.signals TO service_role;
ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signals are publicly readable" ON public.signals FOR SELECT USING (true);

-- Price snapshots
CREATE TABLE public.price_snapshots (
  id bigserial PRIMARY KEY,
  signal_id uuid NOT NULL REFERENCES public.signals(id) ON DELETE CASCADE,
  ticker text NOT NULL,
  price numeric NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX price_snapshots_signal_id_idx ON public.price_snapshots(signal_id, captured_at DESC);
CREATE INDEX price_snapshots_ticker_idx ON public.price_snapshots(ticker, captured_at DESC);

GRANT SELECT ON public.price_snapshots TO anon, authenticated;
GRANT ALL ON public.price_snapshots TO service_role;
ALTER TABLE public.price_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Snapshots are publicly readable" ON public.price_snapshots FOR SELECT USING (true);

-- Enable pg_net for scheduled HTTP calls (pg_cron gets enabled by the schedule migration later)
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;
