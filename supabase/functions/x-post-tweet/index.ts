import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const TweetActionSchema = z.object({
  action: z.enum(['tweet', 'getUser']),
  tweetText: z.string().trim().max(280).optional(),
  mediaUrls: z.array(z.string()).optional(),
});

// Option 1: Use Bearer Token (simpler, single account)
const BEARER_TOKEN = Deno.env.get("X_BEARER_TOKEN")?.trim();

async function sendTweetWithBearer(tweetText: string, mediaUrls?: string[]): Promise<any> {
  const url = "https://api.x.com/2/tweets";
  
  console.log("Posting tweet with Bearer token, text length:", tweetText?.length || 0);
  console.log("Media URLs:", mediaUrls);
  
  // Note: Twitter/X Bearer tokens do NOT support media upload
  // Media upload requires OAuth 1.0a authentication
  // For now, we can only post text with Bearer token
  
  if (mediaUrls && mediaUrls.length > 0) {
    console.warn("⚠️ Media URLs provided but Bearer token cannot upload media");
    console.warn("Twitter requires OAuth 1.0a for media uploads");
    console.warn("Posting text-only tweet");
  }
  
  const tweetPayload: any = { text: tweetText || '' };
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${BEARER_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(tweetPayload),
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

async function getUserWithBearer(): Promise<any> {
  const url = "https://api.x.com/2/users/me";
  
  console.log("Getting user info with Bearer token...");
  
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${BEARER_TOKEN}`,
      "Content-Type": "application/json",
    },
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

    const body = await req.json();
    
    // Validate input
    const validated = TweetActionSchema.parse(body);
    const { action, tweetText, mediaUrls } = validated;

    // Use Bearer token if available, otherwise error
    if (!BEARER_TOKEN) {
      throw new Error('X_BEARER_TOKEN not configured');
    }

    let result;
    
    switch (action) {
      case 'tweet':
        if (!tweetText && (!mediaUrls || mediaUrls.length === 0)) {
          throw new Error('Tweet text or media is required');
        }
        result = await sendTweetWithBearer(tweetText || '', mediaUrls);
        break;
      
      case 'getUser':
        result = await getUserWithBearer();
        break;
      
      default:
        throw new Error('Invalid action. Use "tweet" or "getUser"');
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
