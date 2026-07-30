ALTER TABLE public.signals
  ADD COLUMN IF NOT EXISTS price_status text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS price_error text,
  ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS quote_symbol text;

UPDATE public.signals SET price_status = 'ok' WHERE signal_price IS NOT NULL;
UPDATE public.signals SET quote_symbol = ticker WHERE quote_symbol IS NULL;

DELETE FROM public.price_snapshots WHERE signal_id IN (SELECT id FROM public.signals WHERE ticker = 'EPIC');
DELETE FROM public.signals WHERE ticker = 'EPIC';