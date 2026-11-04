-- Personal 1-5 rating + short review note on closed paper trades (Scorecard "Rate closed positions").
ALTER TABLE public.paper_trades
  ADD COLUMN IF NOT EXISTS rating smallint,
  ADD COLUMN IF NOT EXISTS rating_note text,
  ADD COLUMN IF NOT EXISTS rated_at timestamptz;

ALTER TABLE public.paper_trades
  DROP CONSTRAINT IF EXISTS paper_trades_rating_range;
ALTER TABLE public.paper_trades
  ADD CONSTRAINT paper_trades_rating_range CHECK (rating IS NULL OR (rating BETWEEN 1 AND 5));