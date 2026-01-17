-- Enable Realtime for TribeBuilders Tables
-- Run this in your Supabase SQL Editor

-- Enable Realtime for generated_content table
ALTER PUBLICATION supabase_realtime ADD TABLE generated_content;

-- Enable Realtime for ai_generation_logs table
ALTER PUBLICATION supabase_realtime ADD TABLE ai_generation_logs;

-- Enable Realtime for content_performance table
ALTER PUBLICATION supabase_realtime ADD TABLE content_performance;

-- Enable Realtime for artist_personas table
ALTER PUBLICATION supabase_realtime ADD TABLE artist_personas;

-- Enable Realtime for artists table
ALTER PUBLICATION supabase_realtime ADD TABLE artists;

-- Verify enabled tables
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;

-- If the publication doesn't exist, create it:
-- CREATE PUBLICATION supabase_realtime FOR ALL TABLES;
