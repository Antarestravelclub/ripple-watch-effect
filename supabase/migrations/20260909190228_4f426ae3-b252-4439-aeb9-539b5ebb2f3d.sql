CREATE TABLE public.bridge_secrets (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  secret text NOT NULL UNIQUE,
  allowed_account text,
  rotated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bridge_secrets TO authenticated;
GRANT ALL ON public.bridge_secrets TO service_role;

ALTER TABLE public.bridge_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their own bridge secret"
  ON public.bridge_secrets FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_bridge_secrets_updated_at
  BEFORE UPDATE ON public.bridge_secrets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();