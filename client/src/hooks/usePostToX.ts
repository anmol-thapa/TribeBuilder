import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function usePostToX() {
  const [isPosting, setIsPosting] = useState(false);
  const { toast } = useToast();

  const postToX = async (content: string, mediaUrls?: string[], postId?: string) => {
    setIsPosting(true);
    try {
      const { data, error } = await supabase.functions.invoke('post-to-x', {
        body: { content, mediaUrls, postId },
      });

      if (error) throw error;

      toast({
        title: 'Posted to X!',
        description: 'Your post has been published to X',
      });

      return data;
    } catch (error: any) {
      console.error('Error posting to X:', error);
      toast({
        title: 'Failed to post to X',
        description: error.message || 'An error occurred while posting.',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setIsPosting(false);
    }
  };

  return {
    postToX,
    isPosting,
  };
}
