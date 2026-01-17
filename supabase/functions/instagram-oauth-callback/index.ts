import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encryptTokens } from "../_shared/encryption.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Frontend URL for redirects
const FRONTEND_URL = Deno.env.get('FRONTEND_URL') || Deno.env.get('APP_URL') || 'http://localhost:8080';

serve(async (req) => {
  const url = new URL(req.url);
  
  console.log('[Instagram OAuth Callback] === Request received ===');
  console.log('[Instagram OAuth Callback] Method:', req.method);
  console.log('[Instagram OAuth Callback] URL:', req.url);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Instagram redirects via GET with query parameters
    if (req.method === 'GET') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');
      const errorReason = url.searchParams.get('error_reason');
      const errorDescription = url.searchParams.get('error_description');

      console.log('[Instagram OAuth Callback] Code present:', !!code);
      console.log('[Instagram OAuth Callback] State:', state);

      // Handle errors from Instagram
      if (error) {
        console.error('[Instagram OAuth Callback] Error from Instagram:', error);
        console.error('[Instagram OAuth Callback] Error reason:', errorReason);
        console.error('[Instagram OAuth Callback] Error description:', errorDescription);
        
        return new Response(null, {
          status: 302,
          headers: {
            'Location': `${FRONTEND_URL}/dashboard?error=${encodeURIComponent(errorDescription || error)}`,
          },
        });
      }

      if (!code) {
        console.error('[Instagram OAuth Callback] No authorization code received');
        return new Response(null, {
          status: 302,
          headers: {
            'Location': `${FRONTEND_URL}/dashboard?error=No authorization code received`,
          },
        });
      }

      // State format: "instagram_<user_id>" - we need to extract user_id
      // For now, we'll use a session-based approach with a state token stored in KV
      // But for simplicity, let's parse the user_id from state if provided
      let userId: string | null = null;
      
      if (state && state.startsWith('instagram_')) {
        userId = state.replace('instagram_', '');
        console.log('[Instagram OAuth Callback] User ID from state:', userId);
      }

      // Initialize Supabase with service role for database operations
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
      
      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

      // If no user ID in state, try to get from a pending auth record
      if (!userId) {
        // Check for recent pending Instagram auth
        const { data: pendingAuth } = await supabaseAdmin
          .from('kv_store_eac2062e')
          .select('value')
          .eq('key', `instagram_pending_${code.substring(0, 20)}`)
          .single();
        
        if (pendingAuth?.value) {
          userId = pendingAuth.value;
          console.log('[Instagram OAuth Callback] User ID from pending auth:', userId);
        }
      }

      if (!userId) {
        console.error('[Instagram OAuth Callback] Could not determine user ID');
        return new Response(null, {
          status: 302,
          headers: {
            'Location': `${FRONTEND_URL}/dashboard?error=Authentication session expired. Please try again.`,
          },
        });
      }

      // Exchange code for access token
      console.log('[Instagram OAuth Callback] Exchanging code for access token');
      
      const igAppId = '1408252954304770';
      const igAppSecret = Deno.env.get('INSTAGRAM_APP_SECRET') || '';
      const redirectUri = `${supabaseUrl}/functions/v1/instagram-oauth-callback`;

      console.log('[Instagram OAuth Callback] App ID:', igAppId);
      console.log('[Instagram OAuth Callback] Redirect URI:', redirectUri);

      const tokenResponse = await fetch('https://api.instagram.com/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: igAppId,
          client_secret: igAppSecret,
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        }),
      });

      console.log('[Instagram OAuth Callback] Token response status:', tokenResponse.status);
      const tokenData = await tokenResponse.json();
      
      if (!tokenData.access_token) {
        console.error('[Instagram OAuth Callback] Token exchange failed:', JSON.stringify(tokenData));
        return new Response(null, {
          status: 302,
          headers: {
            'Location': `${FRONTEND_URL}/dashboard?error=${encodeURIComponent(tokenData.error_message || 'Failed to get access token')}`,
          },
        });
      }

      console.log('[Instagram OAuth Callback] Access token obtained successfully');
      const accessToken = tokenData.access_token;
      const igUserId = tokenData.user_id;

      // Get long-lived access token (lasts 60 days)
      console.log('[Instagram OAuth Callback] Exchanging for long-lived token');
      const longLivedResponse = await fetch(
        `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${igAppSecret}&access_token=${accessToken}`
      );
      
      const longLivedData = await longLivedResponse.json();
      const longLivedToken = longLivedData.access_token || accessToken;
      const expiresIn = longLivedData.expires_in || null;
      
      console.log('[Instagram OAuth Callback] Long-lived token obtained:', !!longLivedData.access_token);
      console.log('[Instagram OAuth Callback] Token expires in:', expiresIn, 'seconds');

      // Get user profile
      console.log('[Instagram OAuth Callback] Fetching user profile');
      const userResponse = await fetch(
        `https://graph.instagram.com/me?fields=id,username,account_type,media_count&access_token=${longLivedToken}`
      );
      
      const userData = await userResponse.json();
      console.log('[Instagram OAuth Callback] User profile response:', JSON.stringify(userData));
      
      if (userData.error) {
        console.error('[Instagram OAuth Callback] Failed to get user profile:', userData.error);
        return new Response(null, {
          status: 302,
          headers: {
            'Location': `${FRONTEND_URL}/dashboard?error=${encodeURIComponent(userData.error.message || 'Failed to get profile')}`,
          },
        });
      }

      console.log('[Instagram OAuth Callback] Username:', userData.username);
      console.log('[Instagram OAuth Callback] Account type:', userData.account_type);

      // Encrypt tokens
      console.log('[Instagram OAuth Callback] Encrypting tokens');
      const encryptedTokens = await encryptTokens({
        access_token: longLivedToken,
      });

      // Store connection in database
      console.log('[Instagram OAuth Callback] Storing connection for user:', userId);
      
      const { data: connection, error: dbError } = await supabaseAdmin
        .from('social_connections')
        .upsert({
          user_id: userId,
          platform: 'instagram',
          platform_user_id: userData.id || igUserId,
          username: userData.username,
          display_name: userData.username,
          access_token: encryptedTokens.access_token!,
          token_expires_at: expiresIn 
            ? new Date(Date.now() + expiresIn * 1000).toISOString()
            : null,
          followers_count: 0,
          posts_count: userData.media_count || 0,
          is_active: true,
        }, {
          onConflict: 'user_id,platform',
        })
        .select()
        .single();

      if (dbError) {
        console.error('[Instagram OAuth Callback] Database error:', dbError);
        return new Response(null, {
          status: 302,
          headers: {
            'Location': `${FRONTEND_URL}/dashboard?error=${encodeURIComponent('Failed to save connection')}`,
          },
        });
      }

      console.log('[Instagram OAuth Callback] Connection stored successfully:', connection?.id);
      console.log('[Instagram OAuth Callback] Redirecting to dashboard');

      // Redirect back to the app
      return new Response(null, {
        status: 302,
        headers: {
          'Location': `${FRONTEND_URL}/dashboard?instagram_connected=true`,
        },
      });
    }

    // POST request - handle programmatic auth (for future use)
    if (req.method === 'POST') {
      const body = await req.json();
      console.log('[Instagram OAuth Callback] POST request received');
      
      return new Response(JSON.stringify({ error: 'Use GET request for OAuth callback' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response('Method not allowed', { status: 405 });

  } catch (error) {
    console.error('[Instagram OAuth Callback] Unhandled error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(null, {
      status: 302,
      headers: {
        'Location': `${FRONTEND_URL}/dashboard?error=${encodeURIComponent(errorMessage)}`,
      },
    });
  }
});
