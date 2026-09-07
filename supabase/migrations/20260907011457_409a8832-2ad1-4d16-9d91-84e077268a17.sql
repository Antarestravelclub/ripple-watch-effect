CREATE TABLE public.evaluation_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  finished_at timestamptz NOT NULL DEFAULT now(),
  evaluated integer NOT NULL DEFAULT 0,
  relevelled integer NOT NULL DEFAULT 0,
  target_hits integer NOT NULL DEFAULT 0,
  invalidated integer NOT NULL DEFAULT 0,
  expired integer NOT NULL DEFAULT 0,
  priced integer NOT NULL DEFAULT 0,
  ok boolean NOT NULL DEFAULT true,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.evaluation_runs TO anon;
GRANT SELECT ON public.evaluation_runs TO authenticated;
GRANT ALL ON public.evaluation_runs TO service_role;

ALTER TABLE public.evaluation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Evaluation runs are public" ON public.evaluation_runs FOR SELECT USING (true);

CREATE INDEX evaluation_runs_finished_at_idx ON public.evaluation_runs (finished_at DESC);