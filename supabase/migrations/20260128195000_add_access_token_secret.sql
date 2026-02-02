-- Add access_token_secret for X OAuth 1.0a

ALTER TABLE public.social_connections
  ADD COLUMN IF NOT EXISTS access_token_secret TEXT;
