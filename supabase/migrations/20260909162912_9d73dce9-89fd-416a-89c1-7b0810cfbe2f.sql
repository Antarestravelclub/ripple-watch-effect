CREATE TABLE public.paper_trades (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  signal_id uuid NOT NULL REFERENCES public.signals(id) ON DELETE CASCADE,
  ticker text NOT NULL,
  quote_symbol text,
  direction text NOT NULL CHECK (direction IN ('long','short')),
  entry_price numeric NOT NULL CHECK (entry_price > 0),
  entry_time timestamptz NOT NULL DEFAULT now(),
  stop_price numeric NOT NULL CHECK (stop_price > 0),
  target_price numeric NOT NULL CHECK (target_price > 0),
  position_size numeric NOT NULL CHECK (position_size > 0),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  exit_price numeric,
  exit_time timestamptz,
  exit_reason text CHECK (exit_reason IN ('target_hit','stop_hit','invalidated','manual')),
  realized_pnl numeric,
  overrides_used boolean NOT NULL DEFAULT false,
  both_touched boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.paper_trades TO authenticated;
GRANT ALL ON public.paper_trades TO service_role;

ALTER TABLE public.paper_trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own paper trades"
ON public.paper_trades FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE UNIQUE INDEX paper_trades_one_open_per_signal
  ON public.paper_trades (user_id, signal_id) WHERE status = 'open';
CREATE INDEX paper_trades_status_idx ON public.paper_trades (status);
CREATE INDEX paper_trades_user_idx ON public.paper_trades (user_id, entry_time DESC);

CREATE TRIGGER update_paper_trades_updated_at
BEFORE UPDATE ON public.paper_trades
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();