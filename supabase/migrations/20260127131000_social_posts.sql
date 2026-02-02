-- Social posts table (ported from tribebuilder-hub)

CREATE TABLE IF NOT EXISTS public.social_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id UUID NOT NULL REFERENCES public.social_connections(id) ON DELETE CASCADE,
  platform_post_id TEXT NOT NULL,
  content TEXT,
  media_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
  post_url TEXT,
  posted_at TIMESTAMP WITH TIME ZONE NOT NULL,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  retweets_count INTEGER DEFAULT 0,
  views_count INTEGER DEFAULT 0,
  followers_at_post INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(connection_id, platform_post_id)
);

ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can view posts for their connections'
  ) THEN
    CREATE POLICY "Users can view posts for their connections"
      ON public.social_posts
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM social_connections
          WHERE social_connections.id = social_posts.connection_id
          AND social_connections.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'System can insert posts'
  ) THEN
    CREATE POLICY "System can insert posts"
      ON public.social_posts
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM social_connections
          WHERE social_connections.id = social_posts.connection_id
          AND social_connections.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'System can update posts'
  ) THEN
    CREATE POLICY "System can update posts"
      ON public.social_posts
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM social_connections
          WHERE social_connections.id = social_posts.connection_id
          AND social_connections.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_social_posts_updated_at'
  ) THEN
    CREATE TRIGGER update_social_posts_updated_at
    BEFORE UPDATE ON public.social_posts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_social_posts_connection_id
  ON public.social_posts(connection_id);

CREATE INDEX IF NOT EXISTS idx_social_posts_posted_at
  ON public.social_posts(posted_at DESC);
