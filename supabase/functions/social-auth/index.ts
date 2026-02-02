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

  const frontendUrl = (Deno.env.get('FRONTEND_URL') || '').trim();
  const redirectToFrontend = (params: Record<string, string>) => {
    const origin =
      frontendUrl ||
      req.headers.get('origin') ||
      req.headers.get('referer') ||
      '';

    if (!origin) {
      return new Response(
        JSON.stringify({ error: 'FRONTEND_URL is not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalized = origin.endsWith('/')
      ? origin.slice(0, -1)
      : origin;
    const base = normalized.startsWith('http') ? normalized : `https://${normalized}`;
    const url = new URL(`${base}/oauth/complete`);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    return Response.redirect(url.toString(), 302);
  };

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    const SocialAuthSchema = z.object({
      platform: z.enum(['youtube', 'instagram', 'facebook'], {
        errorMap: () => ({ message: 'Platform must be one of: youtube, instagram, facebook' })
      }),
      code: z.string().min(1, 'Authorization code is required'),
      state: z.string().min(1, 'State parameter is required'),
    });

    let platform = '';
    let code = '';
    let state = '';
    let userId = '';

    if (req.method === 'GET') {
      const url = new URL(req.url);
      code = url.searchParams.get('code') || '';
      state = url.searchParams.get('state') || '';
      platform = state.split('_')[0] || '';
      userId = state.split('_')[1] || '';
    } else {
      const body = await req.json();
      const validationResult = SocialAuthSchema.safeParse(body);

      if (!validationResult.success) {
        const errors = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        throw new Error(`Validation failed: ${errors}`);
      }

      platform = validationResult.data.platform;
      code = validationResult.data.code;
      state = validationResult.data.state;
      userId = state.split('_')[1] || '';
    }

    if (!platform || !code || !state || !userId) {
      throw new Error('Missing platform/code/state/userId');
    }

    console.log(`Processing ${platform} auth callback for user:`, userId);

    let accessToken: string;
    let platformUserData: any;
    let refreshToken: string | null = null;
    let expiresIn: number | null = null;

    switch (platform) {
      case 'youtube': {
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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

        const channelResponse = await fetch(
          `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true&key=${Deno.env.get('YOUTUBE_API_KEY')}`,
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );

        const channelData = await channelResponse.json();
        if (!channelResponse.ok) {
          console.error('YouTube channel API error:', channelData);
          throw new Error(channelData.error?.message || 'Failed to fetch YouTube channel data');
        }
        if (!channelData.items?.[0]) {
          console.error('YouTube channel API returned no items:', channelData);
          throw new Error('No YouTube channel found for this account');
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
      }

      case 'instagram': {
        const igAppId = '1408252954304770';
        const igAppSecret = Deno.env.get('INSTAGRAM_APP_SECRET') || '';

        const igTokenResponse = await fetch('https://api.instagram.com/oauth/access_token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: igAppId,
            client_secret: igAppSecret,
            code: code,
            grant_type: 'authorization_code',
            redirect_uri: `${Deno.env.get('SUPABASE_URL')}/functions/v1/social-auth`,
          }),
        });

        const igTokenData = await igTokenResponse.json();
        if (!igTokenData.access_token) {
          throw new Error(igTokenData.error_message || 'Failed to get Instagram access token');
        }

        accessToken = igTokenData.access_token;
        refreshToken = igTokenData.refresh_token || null;

        const igUserResponse = await fetch(
          `https://graph.instagram.com/me?fields=id,username,account_type,media_count&access_token=${accessToken}`
        );

        const igUserData = await igUserResponse.json();
        if (igUserData.error) {
          throw new Error(igUserData.error.message || 'Failed to fetch Instagram user profile');
        }

        platformUserData = {
          platform_user_id: igUserData.id,
          username: igUserData.username,
          display_name: igUserData.username,
          followers_count: 0,
          posts_count: igUserData.media_count || 0,
        };
        break;
      }

      case 'facebook': {
        const fbAppId = '1101468621955068';
        const fbAppSecret = Deno.env.get('META_APP_SECRET') || '';

        const fbTokenResponse = await fetch('https://graph.facebook.com/v18.0/oauth/access_token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: fbAppId,
            client_secret: fbAppSecret,
            code: code,
            redirect_uri: `${Deno.env.get('SUPABASE_URL')}/functions/v1/social-auth`,
          }),
        });

        const fbTokenData = await fbTokenResponse.json();
        if (!fbTokenData.access_token) {
          throw new Error(fbTokenData.error?.message || 'Failed to get Facebook access token');
        }
        accessToken = fbTokenData.access_token;
        expiresIn = fbTokenData.expires_in || null;

        const fbUserResponse = await fetch(
          `https://graph.facebook.com/v18.0/me?fields=id,name,email,picture&access_token=${accessToken}`
        );
        const fbUserData = await fbUserResponse.json();

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
      }

      default:
        throw new Error(`Platform ${platform} not supported by this endpoint`);
    }

    const encryptedTokens = await encryptTokens({
      access_token: accessToken,
      refresh_token: refreshToken || undefined,
    });

    const { data: connection, error } = await supabaseAdmin
      .from('social_connections')
      .upsert({
        user_id: userId,
        platform: platform,
        access_token: encryptedTokens.access_token!,
        refresh_token: encryptedTokens.refresh_token || null,
        token_expires_at: expiresIn
          ? new Date(Date.now() + expiresIn * 1000).toISOString()
          : null,
        is_active: true,
        ...platformUserData,
      }, {
        onConflict: 'user_id,platform',
      })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      throw new Error('Failed to save connection');
    }

    if (req.method === 'GET') {
      return redirectToFrontend({ success: '1', platform });
    }

    return new Response(JSON.stringify({ success: true, connection }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Social auth error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    if (req.method === 'GET') {
      return redirectToFrontend({ success: '0', platform: 'social', error: errorMessage });
    }

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
