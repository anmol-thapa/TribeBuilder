-- Social connections schema (ported from tribebuilder-hub)

-- Ensure update timestamp helper exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Base table
CREATE TABLE IF NOT EXISTS public.social_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  platform_user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  display_name TEXT,
  profile_image_url TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  followers_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  posts_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, platform)
);

-- Extra columns for X/Twitter OAuth + profile metadata
ALTER TABLE public.social_connections
  ADD COLUMN IF NOT EXISTS access_token_secret TEXT,
  ADD COLUMN IF NOT EXISTS user_handle TEXT,
  ADD COLUMN IF NOT EXISTS profile_data JSONB DEFAULT '{}'::jsonb;

-- Platform constraint (include reddit)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'social_connections_platform_check'
  ) THEN
    ALTER TABLE public.social_connections DROP CONSTRAINT social_connections_platform_check;
  END IF;
  ALTER TABLE public.social_connections
    ADD CONSTRAINT social_connections_platform_check
    CHECK (platform = ANY (ARRAY['instagram','twitter','facebook','linkedin','youtube','reddit']));
END $$;

-- Enable RLS
ALTER TABLE public.social_connections ENABLE ROW LEVEL SECURITY;

-- RLS policies (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own social connections'
  ) THEN
    CREATE POLICY "Users can view their own social connections"
      ON public.social_connections
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can create their own social connections'
  ) THEN
    CREATE POLICY "Users can create their own social connections"
      ON public.social_connections
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their own social connections'
  ) THEN
    CREATE POLICY "Users can update their own social connections"
      ON public.social_connections
      FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete their own social connections'
  ) THEN
    CREATE POLICY "Users can delete their own social connections"
      ON public.social_connections
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Trigger for updated_at (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_social_connections_updated_at'
  ) THEN
    CREATE TRIGGER update_social_connections_updated_at
    BEFORE UPDATE ON public.social_connections
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_social_connections_user_platform
  ON public.social_connections(user_id, platform);

-- Analytics table
CREATE TABLE IF NOT EXISTS public.social_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id UUID NOT NULL REFERENCES public.social_connections(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  followers_count INTEGER DEFAULT 0,
  engagement_rate DECIMAL(5,2) DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  profile_views INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(connection_id, date)
);

ALTER TABLE public.social_analytics ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can view analytics for their connections'
  ) THEN
    CREATE POLICY "Users can view analytics for their connections"
      ON public.social_analytics
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.social_connections
          WHERE social_connections.id = social_analytics.connection_id
          AND social_connections.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert analytics for their connections'
  ) THEN
    CREATE POLICY "Users can insert analytics for their connections"
      ON public.social_analytics
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.social_connections
          WHERE social_connections.id = social_analytics.connection_id
          AND social_connections.user_id = auth.uid()
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_social_analytics_connection_date
  ON public.social_analytics(connection_id, date DESC);

-- Safe view excluding tokens
DROP VIEW IF EXISTS public.social_connections_safe;

CREATE VIEW public.social_connections_safe
WITH (security_invoker = true)
AS
SELECT
  id,
  user_id,
  platform,
  platform_user_id,
  username,
  display_name,
  user_handle,
  profile_image_url,
  followers_count,
  following_count,
  posts_count,
  is_active,
  created_at,
  updated_at,
  profile_data,
  CASE WHEN access_token IS NOT NULL THEN true ELSE false END AS has_access_token,
  CASE WHEN refresh_token IS NOT NULL THEN true ELSE false END AS has_refresh_token,
  token_expires_at
FROM public.social_connections;

GRANT SELECT ON public.social_connections_safe TO authenticated;

COMMENT ON VIEW public.social_connections_safe IS
  'Safe view of social_connections that excludes sensitive OAuth tokens. Use this for frontend queries.';
