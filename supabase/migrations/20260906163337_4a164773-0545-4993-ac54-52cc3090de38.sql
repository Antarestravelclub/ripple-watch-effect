ALTER TABLE public.price_snapshots
  ADD COLUMN IF NOT EXISTS day_high numeric,
  ADD COLUMN IF NOT EXISTS day_low numeric;

ALTER TABLE public.live_events
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS live_events_archived_idx ON public.live_events (archived);