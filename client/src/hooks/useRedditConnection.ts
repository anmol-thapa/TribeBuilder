import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useRedditConnection = () => {
  const [isConnecting, setIsConnecting] = useState(false);

  const connectReddit = async () => {
    try {
      setIsConnecting(true);

      // Get user session for state parameter
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please log in first');
        setIsConnecting(false);
        return;
      }

      // Use the edge function callback URL
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://itztzjoldjttugdnhajd.supabase.co';
      const redirectUri = `${supabaseUrl}/functions/v1/reddit-oauth-callback`;

      // Reddit OAuth URL with user ID in state
      const clientId = import.meta.env.VITE_REDDIT_CLIENT_ID || 'YOUR_REDDIT_CLIENT_ID';
      const state = `reddit_${session.user.id}`;
      const scope = 'identity read submit';

      const authUrl = `https://www.reddit.com/api/v1/authorize?client_id=${clientId}&response_type=code&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}&duration=permanent&scope=${encodeURIComponent(scope)}`;

      // Open Reddit OAuth in a popup
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      const popup = window.open(
        authUrl,
        'Reddit OAuth',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      // Listen for the OAuth callback
      const handleMessage = async (event: MessageEvent) => {
        if (event.data.type === 'reddit-auth-success') {
          toast.success('Reddit connected successfully!');
          window.removeEventListener('message', handleMessage);
          setIsConnecting(false);
          window.location.reload();
        } else if (event.data.type === 'reddit-auth-error') {
          toast.error(event.data.error || 'Failed to connect Reddit');
          window.removeEventListener('message', handleMessage);
          setIsConnecting(false);
        }
      };

      window.addEventListener('message', handleMessage);

      // Check if popup was closed
      const checkPopup = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkPopup);
          window.removeEventListener('message', handleMessage);
          setIsConnecting(false);
        }
      }, 1000);

    } catch (error) {
      console.error('Error initiating Reddit connection:', error);
      toast.error('Failed to initiate Reddit connection');
      setIsConnecting(false);
    }
  };

  return {
    connectReddit,
    isConnecting,
  };
};
