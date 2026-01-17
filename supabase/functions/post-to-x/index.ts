import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "node:crypto";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { decryptTokens } from "../_shared/encryption.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const API_KEY = Deno.env.get("X_API_KEY")?.trim();
const API_SECRET = Deno.env.get("X_KEY_SECRET")?.trim();

function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string
): string {
  const signatureBaseString = `${method}&${encodeURIComponent(
    url
  )}&${encodeURIComponent(
    Object.entries(params)
      .sort()
      .map(([k, v]) => `${k}=${v}`)
      .join("&")
  )}`;
  const signingKey = `${encodeURIComponent(
    consumerSecret
  )}&${encodeURIComponent(tokenSecret)}`;
  const hmacSha1 = createHmac("sha1", signingKey);
  const signature = hmacSha1.update(signatureBaseString).digest("base64");

  return signature;
}

function generateOAuthHeader(
  method: string, 
  url: string,
  accessToken: string,
  accessTokenSecret: string
): string {
  const oauthParams = {
    oauth_consumer_key: API_KEY!,
    oauth_nonce: Math.random().toString(36).substring(2),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: "1.0",
  };

  const signature = generateOAuthSignature(
    method,
    url,
    oauthParams,
    API_SECRET!,
    accessTokenSecret
  );

  const signedOAuthParams = {
    ...oauthParams,
    oauth_signature: signature,
  };

  const entries = Object.entries(signedOAuthParams).sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  return (
    "OAuth " +
    entries
      .map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`)
      .join(", ")
  );
}

async function sendTweetWithOAuth(
  tweetText: string,
  accessToken: string,
  accessTokenSecret: string
): Promise<any> {
  const url = "https://api.x.com/2/tweets";
  const method = "POST";
  
  console.log("Posting tweet with OAuth 1.0a, length:", tweetText.length);
  
  const oauthHeader = generateOAuthHeader(method, url, accessToken, accessTokenSecret);
  
  const response = await fetch(url, {
    method: method,
    headers: {
      "Authorization": oauthHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: tweetText }),
  });

  const responseText = await response.text();
  console.log("X API Response Status:", response.status);
  console.log("X API Response Body:", responseText);

  if (!response.ok) {
    throw new Error(
      `HTTP error! status: ${response.status}, body: ${responseText}`
    );
  }

  return JSON.parse(responseText);
}

// Input validation schema
const PostToXSchema = z.object({
  content: z.string().trim().max(280).optional(),
  mediaUrls: z.array(z.string()).optional(),
  postId: z.string().uuid().optional(),
  _internal_user_id: z.string().uuid().optional(), // For service role calls
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("=== Post to X Function Called ===");

  try {
    if (!API_KEY || !API_SECRET) {
      throw new Error('X API credentials not configured');
    }

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

    const body = await req.json();
    
    // Validate input
    const validated = PostToXSchema.parse(body);
    const { postId, content, mediaUrls, _internal_user_id } = validated;

    if (!content && (!mediaUrls || mediaUrls.length === 0)) {
      throw new Error('Content or media is required');
    }

    // Get user - either from auth or from internal service role call
    let userId: string;
    if (_internal_user_id) {
      // Verify this is a service role call - critical security check
      const authHeader = req.headers.get('Authorization');
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      
      if (!authHeader || !serviceRoleKey || !authHeader.includes(serviceRoleKey)) {
        console.error('Unauthorized attempt to use _internal_user_id without service role');
        throw new Error('Unauthorized: _internal_user_id requires service role authorization');
      }
      
      // Log internal usage for security audit
      console.log('Service role call - posting for user:', _internal_user_id);
      userId = _internal_user_id;
    } else {
      // Regular user call
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (!user) {
        throw new Error('Unauthorized');
      }
      userId = user.id;
    }
    
    console.log("Posting for user:", userId, "Post ID:", postId);

    // Get user's X OAuth tokens from social_connections
    const { data: connection, error: connectionError } = await supabaseClient
      .from('social_connections')
      .select('access_token, access_token_secret, username')
      .eq('user_id', userId)
      .eq('platform', 'twitter')
      .eq('is_active', true)
      .maybeSingle();

    if (connectionError) {
      console.error('Error fetching connection:', connectionError);
      throw new Error('Failed to fetch X connection');
    }

    if (!connection) {
      throw new Error('X account not connected. Please connect your X account first.');
    }

    if (!connection.access_token || !connection.access_token_secret) {
      throw new Error('X account tokens missing. Please reconnect your X account.');
    }

    // Decrypt tokens before use
    const decryptedTokens = await decryptTokens({
      access_token: connection.access_token,
      access_token_secret: connection.access_token_secret,
    });

    console.log("Posting to X as @" + connection.username);

    // Build tweet text with media links if provided
    let tweetText = content || '';
    if (mediaUrls && mediaUrls.length > 0) {
      const mediaLinks = mediaUrls.join('\n');
      tweetText = tweetText ? `${tweetText}\n\n${mediaLinks}` : mediaLinks;
    }

    // Post to X using user's OAuth tokens
    const result = await sendTweetWithOAuth(
      tweetText,
      decryptedTokens.access_token!,
      decryptedTokens.access_token_secret!
    );

    // Update scheduled post status if postId provided
    if (postId) {
      const { error: updateError } = await supabaseClient
        .from('scheduled_posts')
        .update({
          status: 'published',
          post_results: { twitter: result },
        })
        .eq('id', postId)
        .eq('user_id', userId);

      if (updateError) {
        console.error('Failed to update post status:', updateError);
      }
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
