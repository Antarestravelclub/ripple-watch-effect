REVOKE EXECUTE ON FUNCTION public.match_recent_event(text, real) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_recent_event(text, real) TO service_role;