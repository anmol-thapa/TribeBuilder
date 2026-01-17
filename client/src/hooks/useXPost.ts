import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useXPost() {
  const [isPosting, setIsPosting] = useState(false);
  const { toast } = useToast();

  const postTweet = async (tweetText: string, mediaUrls?: string[]) => {
    setIsPosting(true);
    try {
      const { data, error } = await supabase.functions.invoke('x-post-tweet', {
        body: { action: 'tweet', tweetText, mediaUrls },
      });

      if (error) throw error;

      toast({
        title: 'Tweet posted successfully!',
        description: 'Your tweet has been posted to X from your connected account.',
      });

      return data;
    } catch (error: any) {
      console.error('Error posting tweet:', error);
      toast({
        title: 'Failed to post tweet',
        description: error.message || 'An error occurred while posting.',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setIsPosting(false);
    }
  };

  const getXUser = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('x-post-tweet', {
        body: { action: 'getUser' },
      });

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Error getting X user:', error);
      toast({
        title: 'Failed to get user info',
        description: error.message || 'An error occurred.',
        variant: 'destructive',
      });
      throw error;
    }
  };

  return {
    postTweet,
    getXUser,
    isPosting,
  };
}
