import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "node:crypto";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { decryptTokens } from "../_shared/encryption.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const API_KEY = Deno.env.get("X_API_KEY")?.trim();
const API_SECRET = Deno.env.get("X_KEY_SECRET")?.trim();

const TweetActionSchema = z.object({
  action: z.enum(["tweet", "getUser"]),
  tweetText: z.string().trim().max(280).optional(),
  mediaUrls: z.array(z.string()).optional(),
});

function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string
): string {
  const signatureBaseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(
    Object.entries(params)
      .sort()
      .map(([k, v]) => `${k}=${v}`)
      .join("&")
  )}`;
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  const hmacSha1 = createHmac("sha1", signingKey);
  return hmacSha1.update(signatureBaseString).digest("base64");
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

  return (
    "OAuth " +
    Object.entries(signedOAuthParams)
      .sort((a, b) => a[0].localeCompare(b[0]))
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
  const oauthHeader = generateOAuthHeader("POST", url, accessToken, accessTokenSecret);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: oauthHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: tweetText }),
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`X API error (${response.status}): ${responseText}`);
  }

  return JSON.parse(responseText);
}

async function getXUserWithOAuth(
  accessToken: string,
  accessTokenSecret: string
): Promise<any> {
  const url = "https://api.x.com/2/users/me?user.fields=public_metrics,profile_image_url,username";
  const oauthHeader = generateOAuthHeader("GET", "https://api.x.com/2/users/me", accessToken, accessTokenSecret);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: oauthHeader,
      "Content-Type": "application/json",
    },
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`X API error (${response.status}): ${responseText}`);
  }

  return JSON.parse(responseText);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!API_KEY || !API_SECRET) {
      throw new Error("X API credentials not configured");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: {
            Authorization: req.headers.get("Authorization")!,
          },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error("Unauthorized");
    }

    const body = await req.json();
    const validated = TweetActionSchema.parse(body);
    const { action, tweetText, mediaUrls } = validated;

    if (action === "tweet" && !tweetText && (!mediaUrls || mediaUrls.length === 0)) {
      throw new Error("Tweet text or media is required");
    }

    const { data: connection, error: connectionError } = await supabaseClient
      .from("social_connections")
      .select("id, access_token, access_token_secret, username")
      .eq("user_id", user.id)
      .eq("platform", "twitter")
      .eq("is_active", true)
      .maybeSingle();

    if (connectionError) {
      console.error("Error fetching connection:", connectionError);
      throw new Error("Failed to fetch X connection");
    }

    if (!connection) {
      throw new Error("X account not connected. Please connect your X account first.");
    }

    if (!connection.access_token || !connection.access_token_secret) {
      throw new Error("X account tokens missing. Please reconnect your X account.");
    }

    const decryptedTokens = await decryptTokens({
      access_token: connection.access_token,
      access_token_secret: connection.access_token_secret,
    });

    let result: any;
    if (action === "tweet") {
      let tweetTextToSend = tweetText || "";
      if (mediaUrls && mediaUrls.length > 0) {
        const mediaLinks = mediaUrls.join("\n");
        tweetTextToSend = tweetTextToSend
          ? `${tweetTextToSend}\n\n${mediaLinks}`
          : mediaLinks;
      }

      result = await sendTweetWithOAuth(
        tweetTextToSend,
        decryptedTokens.access_token!,
        decryptedTokens.access_token_secret!
      );

      const tweetId = result?.data?.id;
      const username = connection.username || "i";
      const tweetUrl = tweetId ? `https://x.com/${username}/status/${tweetId}` : undefined;

      if (tweetId) {
        const { error: postError } = await supabaseClient
          .from("social_posts")
          .upsert(
            {
              connection_id: connection.id,
              platform_post_id: tweetId,
              content: tweetTextToSend,
              media_urls: mediaUrls || [],
              post_url: tweetUrl,
              posted_at: new Date().toISOString(),
              likes_count: 0,
              comments_count: 0,
              shares_count: 0,
              retweets_count: 0,
              views_count: 0,
              followers_at_post: 0,
            },
            { onConflict: "connection_id,platform_post_id" }
          );

        if (postError) {
          console.error("Error saving X post record:", postError);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: result,
          tweetUrl,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    result = await getXUserWithOAuth(
      decryptedTokens.access_token!,
      decryptedTokens.access_token_secret!
    );

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
