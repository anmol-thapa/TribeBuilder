import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const redditClientId = Deno.env.get('REDDIT_CLIENT_ID')!;
    const redditClientSecret = Deno.env.get('REDDIT_CLIENT_SECRET')!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    console.log('Reddit client ID length:', redditClientId?.length);

    if (!redditClientId || !redditClientSecret) {
      throw new Error('Reddit credentials are missing. Please check the REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET secrets.');
    }

    // Get authenticated user
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { code, redirectUri } = await req.json();

    if (!code) {
      throw new Error('Authorization code is required');
    }

    console.log('Exchanging code for access token...');
    console.log('Redirect URI being sent:', redirectUri);
    console.log('Client ID (full):', redditClientId);
    console.log('Client Secret length:', redditClientSecret?.length);
    console.log('Code length:', code?.length);
    
    // Prepare the request body
    const requestBody = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
    });
    
    console.log('Request body:', requestBody.toString());
    
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

    // Check for HTTP errors BEFORE parsing JSON
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Reddit API Error Response:', errorText);
      throw new Error(`Reddit token exchange failed: HTTP ${tokenResponse.status}. Reddit says: ${errorText}. Check your REDDIT_CLIENT_SECRET and redirect URI: ${redirectUri}`);
    }

    const tokenData = await tokenResponse.json();
    console.log('Token response body:', JSON.stringify(tokenData));

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
    console.log('User data response:', JSON.stringify(userData, null, 2));

    if (!userResponse.ok || userData.error) {
      console.error('Failed to fetch Reddit user data:', userData);
      throw new Error(`Failed to fetch Reddit user data: ${userData.message || userData.error || 'Unknown error'}`);
    }

    // Check if connection already exists
    const { data: existingConnection } = await supabase
      .from('social_connections')
      .select('id')
      .eq('user_id', user.id)
      .eq('platform', 'reddit')
      .eq('platform_user_id', userData.id)
      .single();

    const connectionData = {
      user_id: user.id,
      platform: 'reddit',
      platform_user_id: userData.id,
      username: userData.name,
      display_name: userData.name,
      access_token: accessToken,
      refresh_token: refreshToken,
      profile_image_url: userData.icon_img?.split('?')[0] || null,
      followers_count: userData.total_karma || 0,
      profile_data: {
        link_karma: userData.link_karma,
        comment_karma: userData.comment_karma,
        created_utc: userData.created_utc,
      },
      is_active: true,
    };

    let connection;
    if (existingConnection) {
      const { data, error } = await supabase
        .from('social_connections')
        .update(connectionData)
        .eq('id', existingConnection.id)
        .select()
        .single();

      if (error) throw error;
      connection = data;
      console.log('Updated existing Reddit connection');
    } else {
      const { data, error } = await supabase
        .from('social_connections')
        .insert(connectionData)
        .select()
        .single();

      if (error) throw error;
      connection = data;
      console.log('Created new Reddit connection');
    }

    return new Response(
      JSON.stringify({ success: true, connection }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in reddit-connect:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
