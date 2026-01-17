import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SocialPost {
  id: string;
  connection_id: string;
  platform_post_id: string;
  content: string | null;
  media_urls: string[];
  post_url: string | null;
  posted_at: string;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  retweets_count: number;
  views_count: number;
  followers_at_post: number;
  upvotes_count: number;
  downvotes_count: number;
  created_at: string;
  updated_at: string;
}

export const useSocialPosts = (connectionId?: string) => {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setPosts([]);
        return;
      }

      let query = supabase
        .from('social_posts')
        .select(`
          *,
          social_connections!inner(platform, username, user_id)
        `)
        .order('posted_at', { ascending: false });

      if (connectionId) {
        query = query.eq('connection_id', connectionId);
      } else {
        // Filter by user_id through the join
        query = query.eq('social_connections.user_id', user.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setPosts(data || []);
    } catch (err) {
      console.error('Error fetching posts:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch posts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      await fetchPosts();
    };

    loadData();

    // Set up real-time subscription with user filtering
    const setupSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      console.log('[useSocialPosts] Setting up real-time subscription for user:', user.id);

      const subscription = supabase
        .channel(`social_posts_${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'social_posts',
          },
          (payload) => {
            console.log('[useSocialPosts] Real-time update received:', payload);
            fetchPosts();
          }
        )
        .subscribe();

      return subscription;
    };

    let subscription: any;
    setupSubscription().then(sub => {
      subscription = sub;
    });

    return () => {
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    };
  }, [connectionId]);

  return {
    posts,
    loading,
    error,
    refetch: fetchPosts,
  };
};
