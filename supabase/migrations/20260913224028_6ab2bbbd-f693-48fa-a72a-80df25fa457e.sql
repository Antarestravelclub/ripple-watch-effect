CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE public.news_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  type text NOT NULL DEFAULT 'rss',
  url text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  last_success_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.news_sources TO anon, authenticated;
GRANT ALL ON public.news_sources TO service_role;
ALTER TABLE public.news_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "news_sources readable" ON public.news_sources FOR SELECT USING (true);

INSERT INTO public.news_sources (name, url) VALUES
  ('CNBC Top News','https://www.cnbc.com/id/100003114/device/rss/rss.html'),
  ('CNBC Business','https://www.cnbc.com/id/10001147/device/rss/rss.html'),
  ('CNBC Finance','https://www.cnbc.com/id/10000664/device/rss/rss.html'),
  ('CNBC Earnings','https://www.cnbc.com/id/15839135/device/rss/rss.html'),
  ('CNBC Asia Pacific','https://www.cnbc.com/id/19832390/device/rss/rss.html');

CREATE TABLE public.event_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.live_events(id) ON DELETE CASCADE,
  source_name text NOT NULL,
  url text,
  pub_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX event_sources_event_url_idx ON public.event_sources (event_id, coalesce(url, source_name));
CREATE INDEX event_sources_event_idx ON public.event_sources (event_id);
GRANT SELECT ON public.event_sources TO anon, authenticated;
GRANT ALL ON public.event_sources TO service_role;
ALTER TABLE public.event_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "event_sources readable" ON public.event_sources FOR SELECT USING (true);

CREATE TABLE public.rejected_headlines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  headline text NOT NULL,
  source text,
  url text,
  impact_score integer,
  reason text,
  run_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rejected_headlines_run_idx ON public.rejected_headlines (run_id);
CREATE INDEX rejected_headlines_created_idx ON public.rejected_headlines (created_at DESC);
GRANT SELECT ON public.rejected_headlines TO authenticated;
GRANT ALL ON public.rejected_headlines TO service_role;
ALTER TABLE public.rejected_headlines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rejected_headlines readable to signed in" ON public.rejected_headlines FOR SELECT TO authenticated USING (true);

ALTER TABLE public.live_events
  ADD COLUMN impact_score integer,
  ADD COLUMN impact_direction text,
  ADD COLUMN impact_category text,
  ADD COLUMN impact_reasoning text,
  ADD COLUMN title_norm text;

CREATE INDEX live_events_title_norm_trgm ON public.live_events USING gin (title_norm gin_trgm_ops);
CREATE INDEX live_events_impact_idx ON public.live_events (impact_score DESC, published_at DESC);

CREATE OR REPLACE FUNCTION public.match_recent_event(p_title_norm text, p_threshold real DEFAULT 0.55)
RETURNS TABLE (id uuid, published_at timestamptz, sim real)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id, e.published_at, similarity(e.title_norm, p_title_norm) AS sim
  FROM public.live_events e
  WHERE e.title_norm IS NOT NULL
    AND e.published_at > now() - interval '48 hours'
    AND similarity(e.title_norm, p_title_norm) >= p_threshold
  ORDER BY sim DESC
  LIMIT 1;
$$;