-- Demo-only broker bridge: order queue, fills, and bridge heartbeats.
CREATE TABLE public.broker_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  signal_id uuid NOT NULL REFERENCES public.signals(id) ON DELETE CASCADE,
  ticker text NOT NULL,
  side text NOT NULL CHECK (side IN ('buy','sell')),
  intent text NOT NULL DEFAULT 'open' CHECK (intent IN ('open','close')),
  mode text NOT NULL DEFAULT 'demo' CHECK (mode = 'demo'),
  reference_price numeric,
  stop_price numeric,
  target_price numeric,
  suggested_size_pct numeric,
  conviction_score integer,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','claimed','filled','rejected','skipped')),
  broker_symbol text,
  broker_ticket text,
  filled_price numeric,
  filled_volume numeric,
  filled_at timestamptz,
  error text,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX broker_orders_signal_intent_key
  ON public.broker_orders (signal_id, intent);
CREATE INDEX broker_orders_status_idx ON public.broker_orders (status, created_at DESC);

CREATE TABLE public.broker_bridge_heartbeats (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seen_at timestamptz NOT NULL DEFAULT now(),
  bridge_version text,
  account_login text,
  account_server text,
  account_is_demo boolean,
  balance numeric,
  equity numeric,
  currency text,
  open_positions integer,
  note text
);
CREATE INDEX broker_bridge_heartbeats_seen_idx
  ON public.broker_bridge_heartbeats (seen_at DESC);

GRANT ALL ON public.broker_orders TO service_role;
GRANT ALL ON public.broker_bridge_heartbeats TO service_role;

ALTER TABLE public.broker_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broker_bridge_heartbeats ENABLE ROW LEVEL SECURITY;
-- No policies: only server-side (service role) code touches these tables.