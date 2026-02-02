import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SocialConnection {
  id: string;
  user_id: string;
  platform: string;
  username: string;
  display_name: string;
  profile_image_url?: string;
  followers_count: number;
  following_count: number;
  posts_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SocialAnalytics {
  date: string;
  followers_count: number;
  engagement_rate: number;
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  profile_views: number;
}

export const useSocialData = () => {
  const [connections, setConnections] = useState<SocialConnection[]>([]);
  const [analytics, setAnalytics] = useState<Record<string, SocialAnalytics[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyticsDays, setAnalyticsDays] = useState(30);

  const fetchConnections = async () => {
    try {
      // Get current user ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('[useSocialData] No authenticated user');
        setConnections([]);
        return;
      }

      console.log('[useSocialData] Fetching connections for user:', user.id, user.email);

      // Only select non-sensitive columns - never fetch tokens on frontend
      const { data, error } = await supabase
        .from('social_connections')
        .select('id, user_id, platform, platform_user_id, username, display_name, user_handle, profile_image_url, followers_count, following_count, posts_count, is_active, created_at, updated_at, profile_data')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      console.log('[useSocialData] Fetched connections:', data?.length || 0, 'connections', data);
      setConnections(data || []);
    } catch (err) {
      console.error('[useSocialData] Error fetching connections:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch connections');
    }
  };

  const fetchAnalytics = async (connectionId: string, days: number = 30) => {
    try {
      const { data, error } = await supabase
        .from('social_analytics')
        .select('*')
        .eq('connection_id', connectionId)
        .gte('date', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order('date', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error fetching analytics:', err);
      return [];
    }
  };

  const syncAnalytics = async (platform: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated with Supabase');
      }

      const { data, error } = await supabase.functions.invoke('sync-social-analytics', {
        body: { platform },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        const body = (error as any)?.context?.body;
        let rateLimit: any = null;
        if (body) {
          try {
            const parsed = typeof body === 'string' ? JSON.parse(body) : body;
            rateLimit = parsed?.rateLimit || null;
          } catch {
            rateLimit = null;
          }
        }
        const err: any = new Error(error.message || 'Failed to sync analytics');
        err.rateLimit = rateLimit;
        throw err;
      }
      
      // Refresh connections and analytics after sync
      await fetchConnections();
      return data;
    } catch (err) {
      console.error('Error syncing analytics:', err);
      throw err;
    }
  };

  const disconnectPlatform = async (connectionId: string) => {
    try {
      const { error } = await supabase
        .from('social_connections')
        .update({ is_active: false })
        .eq('id', connectionId);

      if (error) throw error;
      
      // Refresh connections
      await fetchConnections();
    } catch (err) {
      console.error('Error disconnecting platform:', err);
      throw err;
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchConnections();
      setLoading(false);
    };

    loadData();

    // Set up real-time subscriptions with user-specific filter
    const setupSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      console.log('[useSocialData] Setting up real-time subscription for user:', user.id, user.email);

      const connectionsSubscription = supabase
        .channel(`social_connections_${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'social_connections',
            filter: `user_id=eq.${user.id}`, // Only listen to this user's changes
          },
          (payload) => {
            console.log('[useSocialData] Real-time update received:', payload);
            fetchConnections();
          }
        )
        .subscribe();

      return connectionsSubscription;
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
  }, []);

  // Load analytics for all connections
  useEffect(() => {
    const loadAnalytics = async () => {
      const analyticsData: Record<string, SocialAnalytics[]> = {};
      
      for (const connection of connections) {
        const data = await fetchAnalytics(connection.id, analyticsDays);
        analyticsData[connection.id] = data;
      }
      
      setAnalytics(analyticsData);
    };

    if (connections.length > 0) {
      loadAnalytics();
    }
  }, [connections, analyticsDays]);

  return {
    connections,
    analytics,
    loading,
    error,
    syncAnalytics,
    disconnectPlatform,
    refetch: fetchConnections,
    setAnalyticsDays,
  };
};
