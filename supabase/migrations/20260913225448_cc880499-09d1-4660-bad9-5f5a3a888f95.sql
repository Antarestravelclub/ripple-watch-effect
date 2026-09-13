DROP INDEX IF EXISTS public.event_sources_event_url_idx;
CREATE UNIQUE INDEX event_sources_event_url_key ON public.event_sources (event_id, url);
CREATE UNIQUE INDEX event_sources_event_name_key ON public.event_sources (event_id, source_name) WHERE url IS NULL;