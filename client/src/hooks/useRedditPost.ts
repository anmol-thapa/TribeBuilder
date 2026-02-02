import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useRedditPost = () => {
  const [isPosting, setIsPosting] = useState(false);

  const postToReddit = async (content: string, title: string, connectionId: string, mediaUrls?: string[]) => {
    try {
      setIsPosting(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please log in first');
        return null;
      }

      console.log('Posting to Reddit...', { title, contentLength: content.length });

      const response = await supabase.functions.invoke('reddit-post', {
        body: {
          content,
          title,
          connectionId,
          mediaUrls,
        },
      });

      if (response.error) {
        throw response.error;
      }

      console.log('Reddit post response:', response.data);

      return response.data;
    } catch (error) {
      console.error('Error posting to Reddit:', error);
      toast.error(error.message || 'Failed to post to Reddit');
      return null;
    } finally {
      setIsPosting(false);
    }
  };

  return {
    postToReddit,
    isPosting,
  };
};
