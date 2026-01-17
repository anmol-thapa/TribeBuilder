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

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error) {
      console.error('Reddit OAuth error:', error);
      return new Response(
        `<html><body><script>window.close();</script><p>Authentication failed. You can close this window.</p></body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    if (!code || !state) {
      throw new Error('Missing code or state parameter');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const redditClientId = Deno.env.get('REDDIT_CLIENT_ID')!;
    const redditClientSecret = Deno.env.get('REDDIT_CLIENT_SECRET')!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Rate limiting check (10 requests per 5 minutes per state/user)
    const { data: rateLimitCheck } = await supabase.rpc('check_rate_limit', {
      endpoint_name: 'reddit-oauth-callback',
      identifier_value: state,
      max_requests: 10,
      window_minutes: 5
    });

    if (!rateLimitCheck) {
      console.warn('Rate limit exceeded for Reddit OAuth callback');
      throw new Error('Too many authentication attempts. Please try again later.');
    }

    // Get redirect URI from state or construct it
    const redirectUri = `${supabaseUrl}/functions/v1/reddit-oauth-callback`;

    console.log('Exchanging code for access token...');
    console.log('Redirect URI:', redirectUri);
    console.log('Client ID:', redditClientId);

    // Prepare the request body
    const requestBody = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
    });

    // Exchange code for access token
    const tokenResponse = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${redditClientId}:${redditClientSecret}`),
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'SocialMediaManager/1.0',
      },
      body: requestBody,
    });

    console.log('Token response status:', tokenResponse.status);

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Reddit API Error Response:', errorText);
      throw new Error('Failed to authenticate with Reddit');
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;

    console.log('Fetching Reddit user data...');

    // Fetch user data from Reddit
    const userResponse = await fetch('https://oauth.reddit.com/api/v1/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': 'SocialMediaManager/1.0',
      },
    });

    const userData = await userResponse.json();
    console.log('User data fetched:', userData.name);

    if (!userResponse.ok || userData.error) {
      console.error('Failed to fetch Reddit user data:', userData);
      throw new Error('Failed to retrieve Reddit user information');
    }

    // Get user ID from state parameter (passed from frontend)
    const userId = state.split('_')[1]; // Format: "reddit_{userId}"

    if (!userId) {
      throw new Error('Invalid state parameter');
    }

    // Check if connection already exists
    const { data: existingConnection } = await supabase
      .from('social_connections')
      .select('id')
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
      followers_count: userData.total_karma || 0,
      profile_data: {
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
        throw new Error('Failed to save Reddit connection');
      }
      console.log('Updated existing Reddit connection');
    } else {
      const { error: insertError } = await supabase
        .from('social_connections')
        .insert(connectionData);
      
      if (insertError) {
        console.error('Error inserting Reddit connection:', insertError);
        throw new Error('Failed to save Reddit connection');
      }
      console.log('Created new Reddit connection');
    }

    // Close the popup and redirect parent to dashboard
    return new Response(
      `<html><body><script>
        window.opener.postMessage({ type: 'reddit-auth-success' }, '*');
        window.close();
      </script><p>Authentication successful! Closing window...</p></body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  } catch (error) {
    console.error('Error in reddit-oauth-callback:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      `<html><body><script>
        window.opener.postMessage({ type: 'reddit-auth-error', error: '${errorMessage}' }, '*');
        window.close();
      </script><p>Authentication failed. You can close this window.</p></body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
});
