-- Allow updates on social_analytics for owner connections (needed for upsert)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can update analytics for their connections'
  ) THEN
    CREATE POLICY "Users can update analytics for their connections"
      ON public.social_analytics
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM public.social_connections
          WHERE social_connections.id = social_analytics.connection_id
          AND social_connections.user_id = auth.uid()
        )
      );
  END IF;
END $$;
