-- Ensure kv_store_eac2062e exists in remote DB (fix for missing table)

CREATE TABLE IF NOT EXISTS public.kv_store_eac2062e (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.kv_store_eac2062e ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage own kv data'
  ) THEN
    CREATE POLICY "Users can manage own kv data"
      ON public.kv_store_eac2062e
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_kv_store_user_id
  ON public.kv_store_eac2062e(user_id);
