import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useFacebookPost() {
  const [isPosting, setIsPosting] = useState(false);
  const { toast } = useToast();

  const postToFacebook = async (message: string, pageId?: string, mediaUrls?: string[]) => {
    setIsPosting(true);
    try {
      const { data, error } = await supabase.functions.invoke('facebook-post', {
        body: { message, pageId, mediaUrls },
      });

      if (error) throw error;

      toast({
        title: 'Posted to Facebook!',
        description: 'Your post has been published successfully.',
      });

      return data;
    } catch (error: any) {
      console.error('Error posting to Facebook:', error);
      toast({
        title: 'Failed to post',
        description: error.message || 'An error occurred while posting.',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setIsPosting(false);
    }
  };

  return {
    postToFacebook,
    isPosting,
  };
}
