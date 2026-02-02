import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

declare global {
  interface Window {
    FB: any;
    fbAsyncInit: () => void;
  }
}

const FACEBOOK_APP_ID = import.meta.env.VITE_FACEBOOK_APP_ID || '';

export function useFacebookConnection() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const { toast } = useToast();

  const loadFacebookSDK = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      // If already loaded
      if (window.FB) {
        resolve();
        return;
      }

      // Set up init callback
      window.fbAsyncInit = function () {
        window.FB.init({
          appId: FACEBOOK_APP_ID,
          cookie: true,
          xfbml: true,
          version: 'v18.0'
        });
        console.log('Facebook SDK initialized');
        resolve();
      };

      // Load the SDK script
      if (!document.getElementById('facebook-jssdk')) {
        const js = document.createElement('script');
        js.id = 'facebook-jssdk';
        js.src = 'https://connect.facebook.net/en_US/sdk.js';
        js.async = true;
        js.defer = true;
        document.body.appendChild(js);
      }
    });
  }, []);

  const facebookLogin = useCallback((): Promise<{ accessToken: string; userID: string }> => {
    return new Promise((resolve, reject) => {
      if (!window.FB) {
        reject(new Error('Facebook SDK not loaded'));
        return;
      }

      console.log('Opening Facebook login dialog...');
      window.FB.login((response: any) => {
        console.log('Facebook login response:', response);
        if (response.authResponse) {
          resolve({
            accessToken: response.authResponse.accessToken,
            userID: response.authResponse.userID
          });
        } else {
          reject(new Error('Facebook login was cancelled or failed'));
        }
      }, { 
        scope: 'public_profile,email,pages_show_list,pages_read_engagement,pages_manage_posts' 
      });
    });
  }, []);

  const connectFacebook = async () => {
    setIsConnecting(true);
    try {
      // Check authentication first
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('You must be logged in to connect Facebook');
      }

      // Check App ID
      if (!FACEBOOK_APP_ID || FACEBOOK_APP_ID === 'YOUR_FACEBOOK_APP_ID') {
        throw new Error('Facebook App ID is not configured');
      }

      console.log('Loading Facebook SDK...');
      toast({
        title: 'Loading Facebook',
        description: 'Please wait while we prepare the connection...',
      });

      // Load SDK
      await loadFacebookSDK();
      
      // Wait a bit for SDK to fully initialize
      await new Promise(resolve => setTimeout(resolve, 500));

      if (!window.FB) {
        throw new Error('Facebook SDK failed to load. Please refresh and try again.');
      }

      toast({
        title: 'Connecting Facebook',
        description: 'A popup will open - please log in with your Facebook account.',
      });

      // Do the login
      const authResult = await facebookLogin();
      
      console.log('Got Facebook auth:', { 
        userID: authResult.userID, 
        tokenLength: authResult.accessToken?.length 
      });

      if (!authResult.accessToken) {
        throw new Error('No access token received from Facebook');
      }

      // Send to backend
      console.log('Sending token to backend...');
      const { data, error } = await supabase.functions.invoke('facebook-connect-test', {
        body: {
          accessToken: authResult.accessToken,
          userID: authResult.userID
        },
      });

      if (error) {
        console.error('Backend error:', error);
        throw error;
      }

      toast({
        title: 'Facebook Connected!',
        description: `Successfully connected as ${data.user?.name || 'Unknown'}`,
      });
    } catch (error: any) {
      console.error('Error connecting Facebook:', error);
      toast({
        title: 'Connection Failed',
        description: error.message || 'Failed to connect Facebook account',
        variant: 'destructive',
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectFacebook = async (connectionId: string) => {
    setIsDisconnecting(true);
    try {
      const { error } = await supabase
        .from('social_connections')
        .update({ is_active: false })
        .eq('id', connectionId);

      if (error) throw error;

      toast({
        title: 'Disconnected',
        description: 'Your Facebook account has been disconnected.',
      });
    } catch (error: any) {
      console.error('Error disconnecting Facebook:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to disconnect Facebook account',
        variant: 'destructive',
      });
    } finally {
      setIsDisconnecting(false);
    }
  };

  return {
    connectFacebook,
    disconnectFacebook,
    isConnecting,
    isDisconnecting,
  };
}
