ALTER TABLE public.signals
  ADD COLUMN IF NOT EXISTS benchmark_source text NOT NULL DEFAULT 'exact';

ALTER TABLE public.signals
  DROP CONSTRAINT IF EXISTS signals_benchmark_source_check;
ALTER TABLE public.signals
  ADD CONSTRAINT signals_benchmark_source_check
  CHECK (benchmark_source IN ('exact', 'backfilled_daily'));

UPDATE public.signals
SET benchmark_source = 'backfilled_daily'
WHERE benchmark_entry_estimated = true;

CREATE INDEX IF NOT EXISTS signals_benchmark_source_idx
  ON public.signals (benchmark_source);