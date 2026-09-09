ALTER TABLE public.paper_trades ALTER COLUMN signal_id DROP NOT NULL;
ALTER TABLE public.paper_trades ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'signal';
ALTER TABLE public.paper_trades ADD CONSTRAINT paper_trades_source_check CHECK (source IN ('signal','manual'));
CREATE INDEX IF NOT EXISTS paper_trades_user_source_idx ON public.paper_trades (user_id, source);