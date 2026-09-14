ALTER TABLE public.signals ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX idx_signals_user_id ON public.signals (user_id) WHERE user_id IS NOT NULL;