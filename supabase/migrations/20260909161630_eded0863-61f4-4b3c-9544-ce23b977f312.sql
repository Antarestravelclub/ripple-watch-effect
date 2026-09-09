ALTER TABLE public.broker_symbols ADD COLUMN IF NOT EXISTS review_reason text;
CREATE INDEX IF NOT EXISTS idx_broker_symbols_upload_status ON public.broker_symbols(upload_id, mapping_status);
CREATE INDEX IF NOT EXISTS idx_broker_symbols_normalized ON public.broker_symbols(normalized_base);
CREATE INDEX IF NOT EXISTS idx_broker_symbols_app_ticker ON public.broker_symbols(mapped_app_ticker);