import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "node:crypto";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { encryptTokens } from "../_shared/encryption.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schemas
const InitiateActionSchema = z.object({
  action: z.literal('initiate'),
});

const CallbackActionSchema = z.object({
  action: z.literal('callback'),
});

const API_KEY = Deno.env.get("X_API_KEY")?.trim();
const API_SECRET = Deno.env.get("X_KEY_SECRET")?.trim();
const FRONTEND_URL = (Deno.env.get("FRONTEND_URL") || Deno.env.get("APP_URL") || "").trim();

const redirectToFrontend = (params: Record<string, string>) => {
  if (!FRONTEND_URL) {
    return new Response(JSON.stringify({ error: "FRONTEND_URL not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const base = FRONTEND_URL.replace(/\/+$/, "");
  const url = new URL(`${base}/oauth/complete`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return Response.redirect(url.toString(), 302);
};

function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string = ""
): string {
  const signatureBaseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(
    Object.entries(params)
      .sort()
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&")
  )}`;
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  const hmacSha1 = createHmac("sha1", signingKey);
  return hmacSha1.update(signatureBaseString).digest("base64");
}

function generateOAuthHeader(method: string, url: string, additionalParams: Record<string, string> = {}): string {
  const oauthParams = {
    oauth_consumer_key: API_KEY!,
    oauth_nonce: Math.random().toString(36).substring(2),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: "1.0",
    ...additionalParams
  };

  const signature = generateOAuthSignature(method, url, oauthParams, API_SECRET!);
  const signedOAuthParams = { ...oauthParams, oauth_signature: signature };

  return "OAuth " + Object.entries(signedOAuthParams)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`)
    .join(", ");
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Handle GET requests for OAuth callback from X
  if (req.method === 'GET') {
    const url = new URL(req.url);
    if (url.searchParams.has('oauth_token')) {
      // This is the callback from X, handle it as callback action
      try {
        const supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const oauthToken = url.searchParams.get('oauth_token');
        const oauthVerifier = url.searchParams.get('oauth_verifier');
        const denied = url.searchParams.get('denied');

        // Rate limiting disabled for this callback flow

        // User denied authorization
        if (denied) {
          return redirectToFrontend({ success: "0", platform: "twitter", error: "cancelled" });
        }

        if (!oauthToken || !oauthVerifier) {
          throw new Error('Missing oauth parameters');
        }

        // Find the user based on the oauth_token stored earlier
        const { data: kvData } = await supabaseClient
          .from('kv_store_eac2062e')
          .select('user_id, value, key')
          .eq('key', `oauth_token_${oauthToken}`)
          .maybeSingle();

        let kvEntry = kvData;
        if (!kvEntry?.user_id) {
          const { data: legacyKv } = await supabaseClient
            .from('kv_store_eac2062e')
            .select('user_id, value, key')
            .eq('value->>token', oauthToken)
            .maybeSingle();
          kvEntry = legacyKv ?? null;
        }

        if (!kvEntry?.user_id) {
          throw new Error('OAuth session not found or expired');
        }

        const userId = kvEntry.user_id;
        const tokenSecret = kvEntry.value?.secret;

        if (!tokenSecret) {
          throw new Error('Token secret not found');
        }

        // Exchange for access token
        const accessTokenUrl = 'https://api.twitter.com/oauth/access_token';

        const oauthParams = {
          oauth_consumer_key: API_KEY!,
          oauth_nonce: Math.random().toString(36).substring(2),
          oauth_signature_method: "HMAC-SHA1",
          oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
          oauth_version: "1.0",
          oauth_token: oauthToken,
        };

        const signature = generateOAuthSignature('POST', accessTokenUrl, oauthParams, API_SECRET!, tokenSecret);
        const signedOAuthParams = { ...oauthParams, oauth_signature: signature };

        const oauthHeader = "OAuth " + Object.entries(signedOAuthParams)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`)
          .join(", ");

        const accessResponse = await fetch(`${accessTokenUrl}?oauth_verifier=${encodeURIComponent(oauthVerifier)}`, {
          method: 'POST',
          headers: {
            Authorization: oauthHeader,
          },
        });

        const accessResponseText = await accessResponse.text();

        if (!accessResponse.ok) {
          throw new Error(`Failed to get access token: ${accessResponseText}`);
        }

        const accessParams = new URLSearchParams(accessResponseText);
        const accessToken = accessParams.get('oauth_token');
        const accessTokenSecret = accessParams.get('oauth_token_secret');
        const twitterUserId = accessParams.get('user_id');
        const screenName = accessParams.get('screen_name');

        // Encrypt tokens before storing
        const encryptedTokens = await encryptTokens({
          access_token: accessToken || '',
          access_token_secret: accessTokenSecret || '',
        });

        // Store in database using service role
        const { error } = await supabaseClient
          .from('social_connections')
          .upsert({
            user_id: userId,
            platform: 'twitter',
            platform_user_id: twitterUserId || screenName || '',
            username: screenName || '',
            user_handle: `@${screenName}`,
            access_token: encryptedTokens.access_token || '',
            access_token_secret: encryptedTokens.access_token_secret || '',
            is_active: true,
          }, {
            onConflict: 'user_id,platform'
          });

        if (error) {
          console.error('Database error:', error);
          throw error;
        }

        // Clean up the temporary secret
        await supabaseClient
          .from('kv_store_eac2062e')
          .delete()
          .eq('key', `oauth_token_${oauthToken}`);

        // Redirect back to the app
        return redirectToFrontend({ success: "1", platform: "twitter" });
      } catch (error: any) {
        console.error('OAuth callback error:', error);
        return redirectToFrontend({
          success: "0",
          platform: "twitter",
          error: error?.message || "OAuth failed",
        });
      }
    }
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
      const supabaseService = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    const body = await req.json();

    // Validate action
    const actionData = body.action === 'initiate'
      ? InitiateActionSchema.parse(body)
      : CallbackActionSchema.parse(body);
    const { action } = actionData;

    if (action === 'initiate') {
      // Step 1: Request token from X
      const requestTokenUrl = 'https://api.twitter.com/oauth/request_token';
      const callbackUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/x-oauth-callback?action=callback`;

      const oauthParams = {
        oauth_consumer_key: API_KEY!,
        oauth_nonce: Math.random().toString(36).substring(2),
        oauth_signature_method: "HMAC-SHA1",
        oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
        oauth_version: "1.0",
        oauth_callback: callbackUrl
      };

      const signature = generateOAuthSignature('POST', requestTokenUrl, oauthParams, API_SECRET!);
      const signedOAuthParams = { ...oauthParams, oauth_signature: signature };

      const oauthHeader = "OAuth " + Object.entries(signedOAuthParams)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`)
        .join(", ");

      const response = await fetch(requestTokenUrl, {
        method: 'POST',
        headers: {
          Authorization: oauthHeader,
        },
      });

      const responseText = await response.text();

      if (!response.ok) {
        throw new Error(`Failed to get request token: ${responseText}`);
      }

      const params = new URLSearchParams(responseText);
      const oauthToken = params.get('oauth_token');
      const oauthTokenSecret = params.get('oauth_token_secret');

      if (!oauthToken) {
        throw new Error('No oauth_token in response');
      }

      // Store the token secret and token temporarily for callback lookup
      const { error: kvError } = await supabaseService
        .from('kv_store_eac2062e')
        .upsert({
          key: `oauth_token_${oauthToken}`,
          value: { secret: oauthTokenSecret, token: oauthToken, timestamp: Date.now() },
          user_id: user.id
        }, { onConflict: 'key' });

      if (kvError) {
        console.error('Failed to store OAuth token:', kvError);
        throw kvError;
      }

      // Add force_login=true to ensure X asks which account to use
      const authUrl = `https://api.twitter.com/oauth/authorize?oauth_token=${oauthToken}&force_login=true`;

      return new Response(JSON.stringify({
        success: true,
        authUrl,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error('Invalid action - only initiate is supported via POST');

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
