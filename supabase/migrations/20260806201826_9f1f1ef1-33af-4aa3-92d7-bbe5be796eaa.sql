CREATE TABLE public.live_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  headline text NOT NULL,
  summary text NOT NULL DEFAULT '',
  why_markets_care text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT '',
  source_url text,
  published_at timestamp with time zone NOT NULL DEFAULT now(),
  category text NOT NULL DEFAULT 'Geopolitical',
  strength text NOT NULL DEFAULT 'Medium',
  regions text[] NOT NULL DEFAULT '{}'::text[],
  transmission_channel text NOT NULL DEFAULT '',
  dedupe_key text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX live_events_dedupe_key_idx ON public.live_events (dedupe_key);
CREATE INDEX live_events_published_at_idx ON public.live_events (published_at DESC);

GRANT SELECT ON public.live_events TO anon;
GRANT SELECT ON public.live_events TO authenticated;
GRANT ALL ON public.live_events TO service_role;
ALTER TABLE public.live_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Live events are public" ON public.live_events FOR SELECT USING (true);

CREATE TABLE public.live_event_exposures (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  live_event_id uuid NOT NULL REFERENCES public.live_events(id) ON DELETE CASCADE,
  ticker text NOT NULL,
  company_name text,
  side text NOT NULL,
  sector text NOT NULL DEFAULT '',
  mechanism text NOT NULL DEFAULT '',
  confidence text NOT NULL DEFAULT 'Medium',
  quote_symbol text,
  needs_review boolean NOT NULL DEFAULT false,
  review_reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX live_event_exposures_event_idx ON public.live_event_exposures (live_event_id);

GRANT SELECT ON public.live_event_exposures TO anon;
GRANT SELECT ON public.live_event_exposures TO authenticated;
GRANT ALL ON public.live_event_exposures TO service_role;
ALTER TABLE public.live_event_exposures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Live exposures are public" ON public.live_event_exposures FOR SELECT USING (true);

CREATE TABLE public.ingest_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  finished_at timestamp with time zone,
  headlines_seen integer NOT NULL DEFAULT 0,
  events_created integer NOT NULL DEFAULT 0,
  skipped integer NOT NULL DEFAULT 0,
  signals_created integer NOT NULL DEFAULT 0,
  ok boolean NOT NULL DEFAULT false,
  error text
);

CREATE INDEX ingest_runs_started_at_idx ON public.ingest_runs (started_at DESC);

GRANT SELECT ON public.ingest_runs TO anon;
GRANT SELECT ON public.ingest_runs TO authenticated;
GRANT ALL ON public.ingest_runs TO service_role;
ALTER TABLE public.ingest_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ingest runs are public" ON public.ingest_runs FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_live_events_updated_at BEFORE UPDATE ON public.live_events
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();