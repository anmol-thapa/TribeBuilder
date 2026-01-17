import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { encryptTokens } from "../_shared/encryption.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: {
            Authorization: req.headers.get('Authorization')!,
          },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    // Validate request body with Zod
    const SocialAuthSchema = z.object({
      platform: z.enum(['youtube', 'instagram', 'facebook', 'linkedin'], {
        errorMap: () => ({ message: 'Platform must be one of: youtube, instagram, facebook, linkedin' })
      }),
      code: z.string().min(1, 'Authorization code is required'),
      state: z.string().min(1, 'State parameter is required'),
    });

    const body = await req.json();
    const validationResult = SocialAuthSchema.safeParse(body);
    
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      throw new Error(`Validation failed: ${errors}`);
    }

    const { platform, code, state } = validationResult.data;
    console.log(`Processing ${platform} auth callback for user:`, user.id);

    // Rate limiting check (10 requests per 5 minutes per user+platform)
    const { data: rateLimitCheck } = await supabaseClient.rpc('check_rate_limit', {
      endpoint_name: `social-auth-${platform}`,
      identifier_value: user.id,
      max_requests: 10,
      window_minutes: 5
    });

    if (!rateLimitCheck) {
      console.warn(`Rate limit exceeded for ${platform} OAuth callback`);
      throw new Error('Too many authentication attempts. Please try again later.');
    }

    let accessToken: string;
    let platformUserData: any;
    let refreshToken: string | null = null;
    let expiresIn: number | null = null;

    switch (platform) {
      case 'youtube':
        // Exchange code for access token
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            client_id: Deno.env.get('GOOGLE_CLIENT_ID') || '',
            client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') || '',
            code: code,
            grant_type: 'authorization_code',
            redirect_uri: `${Deno.env.get('SUPABASE_URL')}/functions/v1/social-auth`,
          }),
        });

        const tokenData = await tokenResponse.json();
        if (!tokenData.access_token) {
          throw new Error('Failed to get access token');
        }

        accessToken = tokenData.access_token;
        refreshToken = tokenData.refresh_token || null;
        expiresIn = tokenData.expires_in || null;

        // Get user's channel info
        const channelResponse = await fetch(
          `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true&key=${Deno.env.get('YOUTUBE_API_KEY')}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          }
        );

        const channelData = await channelResponse.json();
        if (!channelData.items?.[0]) {
          throw new Error('Failed to get YouTube channel data');
        }

        const channel = channelData.items[0];
        platformUserData = {
          platform_user_id: channel.id,
          username: channel.snippet.customUrl || channel.snippet.title,
          display_name: channel.snippet.title,
          profile_image_url: channel.snippet.thumbnails?.default?.url,
          followers_count: parseInt(channel.statistics.subscriberCount || '0'),
          posts_count: parseInt(channel.statistics.videoCount || '0'),
        };
        break;

      case 'instagram':
        // Instagram Basic Display API flow (separate app from Facebook)
        console.log('[Instagram OAuth] Starting Instagram authentication flow');
        console.log('[Instagram OAuth] User ID:', user.id);
        
        const igAppId = '1408252954304770'; // Instagram App ID
        const igAppSecret = Deno.env.get('INSTAGRAM_APP_SECRET') || '';
        
        console.log('[Instagram OAuth] Exchanging authorization code for access token');
        console.log('[Instagram OAuth] Redirect URI:', `${Deno.env.get('SUPABASE_URL')}/functions/v1/social-auth`);
        
        const igTokenResponse = await fetch('https://api.instagram.com/oauth/access_token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            client_id: igAppId,
            client_secret: igAppSecret,
            code: code,
            grant_type: 'authorization_code',
            redirect_uri: `${Deno.env.get('SUPABASE_URL')}/functions/v1/social-auth`,
          }),
        });

        console.log('[Instagram OAuth] Token response status:', igTokenResponse.status);
        const igTokenData = await igTokenResponse.json();
        
        if (!igTokenData.access_token) {
          console.error('[Instagram OAuth] Token exchange failed:', JSON.stringify(igTokenData));
          console.error('[Instagram OAuth] Error type:', igTokenData.error_type);
          console.error('[Instagram OAuth] Error message:', igTokenData.error_message);
          throw new Error(igTokenData.error_message || 'Failed to get Instagram access token');
        }
        
        console.log('[Instagram OAuth] Successfully obtained access token');
        accessToken = igTokenData.access_token;
        refreshToken = igTokenData.refresh_token || null;
        console.log('[Instagram OAuth] Refresh token present:', !!refreshToken);

        // Get user info
        console.log('[Instagram OAuth] Fetching user profile from Instagram Graph API');
        const igUserResponse = await fetch(
          `https://graph.instagram.com/me?fields=id,username,account_type,media_count&access_token=${accessToken}`
        );
        
        console.log('[Instagram OAuth] User profile response status:', igUserResponse.status);
        const igUserData = await igUserResponse.json();
        
        if (igUserData.error) {
          console.error('[Instagram OAuth] Failed to fetch user profile:', JSON.stringify(igUserData.error));
          throw new Error(igUserData.error.message || 'Failed to fetch Instagram user profile');
        }

        console.log('[Instagram OAuth] User profile retrieved successfully');
        console.log('[Instagram OAuth] Username:', igUserData.username);
        console.log('[Instagram OAuth] Account type:', igUserData.account_type);
        console.log('[Instagram OAuth] Media count:', igUserData.media_count);

        platformUserData = {
          platform_user_id: igUserData.id,
          username: igUserData.username,
          display_name: igUserData.username,
          followers_count: 0, // Basic Display API doesn't provide follower count
          posts_count: igUserData.media_count || 0,
        };
        
        console.log('[Instagram OAuth] Connection data prepared for storage');
        break;

      case 'facebook':
        // Facebook OAuth flow (uses Meta App credentials - shared with Instagram)
        const fbAppId = '1101468621955068'; // Public Meta App ID
        const fbAppSecret = Deno.env.get('META_APP_SECRET') || '';
        
        const fbTokenResponse = await fetch('https://graph.facebook.com/v18.0/oauth/access_token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            client_id: fbAppId,
            client_secret: fbAppSecret,
            code: code,
            redirect_uri: `${Deno.env.get('SUPABASE_URL')}/functions/v1/social-auth`,
          }),
        });

        const fbTokenData = await fbTokenResponse.json();
        if (!fbTokenData.access_token) {
          console.error('Facebook token exchange failed:', fbTokenData);
          throw new Error(fbTokenData.error?.message || 'Failed to get Facebook access token');
        }
        accessToken = fbTokenData.access_token;
        expiresIn = fbTokenData.expires_in || null;

        // Get user info
        const fbUserResponse = await fetch(
          `https://graph.facebook.com/v18.0/me?fields=id,name,email,picture&access_token=${accessToken}`
        );
        const fbUserData = await fbUserResponse.json();

        // Get pages if available
        const fbPagesResponse = await fetch(
          `https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}`
        );
        const fbPagesData = await fbPagesResponse.json();

        platformUserData = {
          platform_user_id: fbUserData.id,
          username: fbUserData.name,
          display_name: fbUserData.name,
          profile_image_url: fbUserData.picture?.data?.url,
          profile_data: {
            email: fbUserData.email,
            pages: fbPagesData.data || []
          },
          followers_count: 0,
          posts_count: 0,
        };
        break;

      default:
        throw new Error(`Platform ${platform} not supported by this endpoint`);
    }

    // Encrypt tokens before storing
    const encryptedTokens = await encryptTokens({
      access_token: accessToken,
      refresh_token: refreshToken || undefined,
    });

    // Store/update connection in database
    const { data: connection, error } = await supabaseClient
      .from('social_connections')
      .upsert({
        user_id: user.id,
        platform: platform,
        access_token: encryptedTokens.access_token!,
        refresh_token: encryptedTokens.refresh_token || null,
        token_expires_at: expiresIn 
          ? new Date(Date.now() + expiresIn * 1000).toISOString()
          : null,
        ...platformUserData,
      })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      throw new Error('Failed to save connection');
    }

    return new Response(JSON.stringify({ success: true, connection }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Social auth error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});