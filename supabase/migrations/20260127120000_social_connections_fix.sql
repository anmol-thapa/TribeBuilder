-- Add missing social_connections columns

ALTER TABLE public.social_connections
  ADD COLUMN IF NOT EXISTS access_token_secret TEXT,
  ADD COLUMN IF NOT EXISTS user_handle TEXT,
  ADD COLUMN IF NOT EXISTS profile_data JSONB DEFAULT '{}'::jsonb;
