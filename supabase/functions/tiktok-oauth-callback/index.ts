import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { encryptTokens } from "../_shared/encryption.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const tiktokClientKey = Deno.env.get('TIKTOK_CLIENT_KEY');
    const tiktokClientSecret = Deno.env.get('TIKTOK_CLIENT_SECRET');

    if (!tiktokClientKey || !tiktokClientSecret) {
      console.error('Missing TikTok credentials - TIKTOK_CLIENT_KEY or TIKTOK_CLIENT_SECRET not set');
      throw new Error('TikTok credentials not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const url = new URL(req.url);
    
    // Validate OAuth callback parameters with Zod
    const OAuthCallbackSchema = z.object({
      code: z.string().min(1, 'Authorization code is required').optional(),
      error: z.string().optional(),
      error_description: z.string().optional(),
      state: z.string().optional(),
    });

    const params = {
      code: url.searchParams.get('code'),
      error: url.searchParams.get('error'),
      error_description: url.searchParams.get('error_description'),
      state: url.searchParams.get('state'),
    };

    console.log('TikTok OAuth callback received:', { 
      hasCode: !!params.code, 
      error: params.error,
      errorDescription: params.error_description,
      state: params.state 
    });

    const validationResult = OAuthCallbackSchema.safeParse(params);
    
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      throw new Error(`Validation failed: ${errors}`);
    }

    const { code, error, error_description, state } = validationResult.data;

    // Handle OAuth errors
    if (error) {
      console.error('TikTok OAuth error:', error, error_description);
      const appUrl = Deno.env.get('APP_URL') || Deno.env.get('FRONTEND_URL') || 'http://localhost:8080';
      return new Response(null, {
        status: 302,
        headers: {
          'Location': `${appUrl}/dashboard?tiktok_error=${encodeURIComponent(error_description || error)}`,
        },
      });
    }

    if (!code) {
      throw new Error('No authorization code provided');
    }

    // Extract user_id from state (format: "tiktok_userId")
    let userId: string | null = null;
    if (state && state.startsWith('tiktok_')) {
      userId = state.replace('tiktok_', '');
    }

    if (!userId) {
      console.error('No user ID in state parameter');
      throw new Error('Invalid state parameter - user identification failed');
    }

    // Rate limiting check (10 requests per 5 minutes per user)
    const { data: rateLimitCheck } = await supabase.rpc('check_rate_limit', {
      endpoint_name: 'tiktok-oauth-callback',
      identifier_value: userId,
      max_requests: 10,
      window_minutes: 5
    });

    if (!rateLimitCheck) {
      console.warn('Rate limit exceeded for TikTok OAuth callback');
      throw new Error('Too many authentication attempts. Please try again later.');
    }

    const redirectUri = `${supabaseUrl}/functions/v1/tiktok-oauth-callback`;
    console.log('Exchanging TikTok authorization code for access token');
    console.log('Using redirect_uri:', redirectUri);

    // Exchange code for access token
    const tokenResponse = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_key: tiktokClientKey,
        client_secret: tiktokClientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    const tokenText = await tokenResponse.text();
    console.log('TikTok token response status:', tokenResponse.status);
    
    let tokenData;
    try {
      tokenData = JSON.parse(tokenText);
    } catch {
      console.error('Failed to parse token response:', tokenText);
      throw new Error('Invalid response from TikTok');
    }

    if (!tokenResponse.ok || tokenData.error) {
      console.error('TikTok token exchange failed:', tokenData);
      throw new Error(tokenData.error_description || tokenData.error || 'Failed to authenticate with TikTok');
    }

    console.log('TikTok token received:', { 
      hasAccessToken: !!tokenData.access_token,
      expiresIn: tokenData.expires_in 
    });

    // Get user info from TikTok
    const userInfoResponse = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });

    if (!userInfoResponse.ok) {
      const userInfoError = await userInfoResponse.text();
      console.error('Failed to fetch TikTok user info:', userInfoError);
      throw new Error('Failed to retrieve TikTok user information');
    }

    const userInfo = await userInfoResponse.json();
    const tiktokUser = userInfo.data?.user;

    if (!tiktokUser) {
      console.error('No user data in TikTok response:', userInfo);
      throw new Error('Invalid TikTok user response');
    }

    console.log('TikTok user info received:', {
      openId: tiktokUser.open_id,
      displayName: tiktokUser.display_name,
    });

    // Encrypt tokens before storing
    const encryptedTokens = await encryptTokens({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
    });

    // Store or update connection in database
    const { data: existingConnection } = await supabase
      .from('social_connections')
      .select('id')
      .eq('user_id', userId)
      .eq('platform', 'tiktok')
      .single();

    const connectionData = {
      user_id: userId,
      platform: 'tiktok',
      platform_user_id: tiktokUser.open_id,
      username: tiktokUser.display_name || 'TikTok User',
      display_name: tiktokUser.display_name,
      access_token: encryptedTokens.access_token!,
      refresh_token: encryptedTokens.refresh_token,
      token_expires_at: new Date(Date.now() + (tokenData.expires_in || 86400) * 1000).toISOString(),
      profile_image_url: tiktokUser.avatar_url,
      profile_data: {
        avatar_url: tiktokUser.avatar_url,
        union_id: tiktokUser.union_id,
      },
      is_active: true,
    };

    let result;
    if (existingConnection) {
      result = await supabase
        .from('social_connections')
        .update(connectionData)
        .eq('id', existingConnection.id);
    } else {
      result = await supabase
        .from('social_connections')
        .insert(connectionData);
    }

    if (result.error) {
      console.error('Database error:', result.error);
      throw result.error;
    }

    console.log('TikTok connection saved successfully for user:', userId);

    // Redirect to dashboard with success message
    const appUrl = Deno.env.get('APP_URL') || Deno.env.get('FRONTEND_URL') || 'http://localhost:8080';
    return new Response(null, {
      status: 302,
      headers: {
        'Location': `${appUrl}/dashboard?tiktok=connected`,
      },
    });

  } catch (error: any) {
    console.error('Error in TikTok OAuth callback:', error);
    const appUrl = Deno.env.get('APP_URL') || Deno.env.get('FRONTEND_URL') || 'http://localhost:8080';
    return new Response(null, {
      status: 302,
      headers: {
        'Location': `${appUrl}/dashboard?tiktok_error=${encodeURIComponent(error.message)}`,
      },
    });
  }
});
