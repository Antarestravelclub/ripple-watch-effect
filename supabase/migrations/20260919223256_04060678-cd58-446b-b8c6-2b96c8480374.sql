DROP POLICY IF EXISTS "Playbooks are public" ON public.archetype_playbooks;
DROP POLICY IF EXISTS "Anyone can read ETF reference" ON public.etf_reference;
DROP POLICY IF EXISTS "Evaluation runs are public" ON public.evaluation_runs;
DROP POLICY IF EXISTS "event_sources readable" ON public.event_sources;
DROP POLICY IF EXISTS "Historical events are public" ON public.historical_events;
DROP POLICY IF EXISTS "Historical reactions are public" ON public.historical_reactions;
DROP POLICY IF EXISTS "Ingest runs are public" ON public.ingest_runs;
DROP POLICY IF EXISTS "Latest prices are public" ON public.latest_prices;
DROP POLICY IF EXISTS "Live exposures are public" ON public.live_event_exposures;
DROP POLICY IF EXISTS "Live events are public" ON public.live_events;
DROP POLICY IF EXISTS "news_sources readable" ON public.news_sources;
DROP POLICY IF EXISTS "Portfolio settings are public" ON public.portfolio_settings;
DROP POLICY IF EXISTS "Price fetch runs are public" ON public.price_fetch_runs;
DROP POLICY IF EXISTS "Snapshots are publicly readable" ON public.price_snapshots;
DROP POLICY IF EXISTS "rejected_headlines readable to signed in" ON public.rejected_headlines;
DROP POLICY IF EXISTS "Evaluation log is public" ON public.signal_evaluation_log;
DROP POLICY IF EXISTS "Signals are publicly readable" ON public.signals;

REVOKE SELECT ON public.archetype_playbooks, public.etf_reference, public.evaluation_runs,
  public.event_sources, public.historical_events, public.historical_reactions,
  public.ingest_runs, public.latest_prices, public.live_event_exposures, public.live_events,
  public.news_sources, public.portfolio_settings, public.price_fetch_runs,
  public.price_snapshots, public.rejected_headlines, public.signal_evaluation_log,
  public.signals FROM anon;

GRANT ALL ON public.archetype_playbooks, public.etf_reference, public.evaluation_runs,
  public.event_sources, public.historical_events, public.historical_reactions,
  public.ingest_runs, public.latest_prices, public.live_event_exposures, public.live_events,
  public.news_sources, public.portfolio_settings, public.price_fetch_runs,
  public.price_snapshots, public.rejected_headlines, public.signal_evaluation_log,
  public.signals TO service_role;

CREATE POLICY "Admins can read ETF reference" ON public.etf_reference
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));