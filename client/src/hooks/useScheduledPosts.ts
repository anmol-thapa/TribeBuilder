import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ScheduledPost {
  id: string;
  content: string;
  platforms: string[];
  scheduled_for: string;
  status: string;
  media_urls?: string[];
  post_results?: any;
  error_message?: string | null;
  created_at: string;
}

export function useScheduledPosts() {
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('scheduled_posts')
        .select('*')
        .order('scheduled_for', { ascending: true });

      if (error) throw error;
      setPosts(data || []);
    } catch (error: any) {
      console.error('Error fetching scheduled posts:', error);
      toast({
        title: 'Failed to load scheduled posts',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();

    // Set up realtime subscription
    const channel = supabase
      .channel('scheduled-posts-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scheduled_posts'
        },
        () => {
          fetchPosts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const schedulePost = async (
    content: string,
    platforms: string[],
    scheduledFor: Date,
    mediaUrls?: string[]
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('scheduled_posts')
        .insert([{
          user_id: user.id,
          content,
          platforms,
          scheduled_for: scheduledFor.toISOString(),
          media_urls: mediaUrls || [],
          status: 'scheduled',
        }])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Post Scheduled!',
        description: `Your post has been scheduled for ${platforms.length} platform(s)`,
      });

      return data;
    } catch (error: any) {
      console.error('Error scheduling post:', error);
      toast({
        title: 'Failed to schedule post',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }
  };

  const cancelPost = async (postId: string) => {
    try {
      const { error } = await supabase
        .from('scheduled_posts')
        .update({ status: 'cancelled' })
        .eq('id', postId);

      if (error) throw error;

      toast({
        title: 'Post Cancelled',
        description: 'The scheduled post has been cancelled',
      });
    } catch (error: any) {
      console.error('Error cancelling post:', error);
      toast({
        title: 'Failed to cancel post',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }
  };

  const deletePost = async (postId: string) => {
    try {
      const { error } = await supabase
        .from('scheduled_posts')
        .delete()
        .eq('id', postId);

      if (error) throw error;

      toast({
        title: 'Post Deleted',
        description: 'The scheduled post has been deleted',
      });
    } catch (error: any) {
      console.error('Error deleting post:', error);
      toast({
        title: 'Failed to delete post',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }
  };

  return {
    posts,
    loading,
    schedulePost,
    cancelPost,
    deletePost,
    refresh: fetchPosts,
  };
}