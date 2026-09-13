ALTER EXTENSION pg_trgm SET SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.match_recent_event(p_title_norm text, p_threshold real DEFAULT 0.55)
RETURNS TABLE (id uuid, published_at timestamptz, sim real)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT e.id, e.published_at, extensions.similarity(e.title_norm, p_title_norm) AS sim
  FROM public.live_events e
  WHERE e.title_norm IS NOT NULL
    AND e.published_at > now() - interval '48 hours'
    AND extensions.similarity(e.title_norm, p_title_norm) >= p_threshold
  ORDER BY sim DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.match_recent_event(text, real) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_recent_event(text, real) TO service_role;