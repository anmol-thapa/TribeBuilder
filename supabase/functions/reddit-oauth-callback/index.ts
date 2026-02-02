import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { encryptTokens } from "../_shared/encryption.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
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
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error) {
      console.error('Reddit OAuth error:', error);
      return redirectToFrontend({ success: '0', platform: 'reddit', error });
    }

    if (!code || !state) {
      return redirectToFrontend({
        success: '0',
        platform: 'reddit',
        error: 'Missing code or state parameter',
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const redditClientId = Deno.env.get('REDDIT_CLIENT_ID')!;
    const redditClientSecret = Deno.env.get('REDDIT_CLIENT_SECRET')!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Get redirect URI from state or construct it
    const redirectUri = `${supabaseUrl}/functions/v1/reddit-oauth-callback`;

    // Exchange code for access token
    const tokenResponse = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${redditClientId}:${redditClientSecret}`),
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'SocialMediaManager/1.0',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Reddit API Error Response:', errorText);
      return redirectToFrontend({ success: '0', platform: 'reddit', error: 'Failed to authenticate with Reddit' });
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;

    // Fetch user data from Reddit
    const userResponse = await fetch('https://oauth.reddit.com/api/v1/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': 'SocialMediaManager/1.0',
      },
    });

    const userData = await userResponse.json();
    if (!userResponse.ok || userData.error) {
      console.error('Failed to fetch Reddit user data:', userData);
      return redirectToFrontend({ success: '0', platform: 'reddit', error: 'Failed to retrieve Reddit user information' });
    }

    // Get user ID from state parameter (passed from frontend)
    const userId = state.split('_')[1]; // Format: "reddit_{userId}"
    if (!userId) {
      return redirectToFrontend({ success: '0', platform: 'reddit', error: 'Invalid state parameter' });
    }

    // Check if connection already exists
    const { data: existingConnection } = await supabase
      .from('social_connections')
      .select('id, followers_count, profile_data')
      .eq('user_id', userId)
      .eq('platform', 'reddit')
      .eq('platform_user_id', userData.id)
      .maybeSingle();

    // Encrypt tokens before storing
    const encryptedTokens = await encryptTokens({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    const connectionData = {
      user_id: userId,
      platform: 'reddit',
      platform_user_id: userData.id,
      username: userData.name,
      display_name: userData.name,
      access_token: encryptedTokens.access_token!,
      refresh_token: encryptedTokens.refresh_token,
      profile_image_url: userData.icon_img?.split('?')[0] || null,
      // Reddit doesn't expose follower count; always keep at 0
      followers_count: 0,
      profile_data: {
        karma: userData.total_karma || 0,
        link_karma: userData.link_karma,
        comment_karma: userData.comment_karma,
        created_utc: userData.created_utc,
      },
      is_active: true,
    };

    if (existingConnection) {
      const { error: updateError } = await supabase
        .from('social_connections')
        .update(connectionData)
        .eq('id', existingConnection.id);

      if (updateError) {
        console.error('Error updating Reddit connection:', updateError);
        return redirectToFrontend({ success: '0', platform: 'reddit', error: 'Failed to save Reddit connection' });
      }
    } else {
      const { error: insertError } = await supabase
        .from('social_connections')
        .insert(connectionData);

      if (insertError) {
        console.error('Error inserting Reddit connection:', insertError);
        return redirectToFrontend({ success: '0', platform: 'reddit', error: 'Failed to save Reddit connection' });
      }
    }

    return redirectToFrontend({ success: '1', platform: 'reddit' });
  } catch (error) {
    console.error('Error in reddit-oauth-callback:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return redirectToFrontend({ success: '0', platform: 'reddit', error: errorMessage });
  }
});
