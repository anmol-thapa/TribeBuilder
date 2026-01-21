// import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
// import { encryptTokens } from "../_shared/encryption.ts";

// const corsHeaders = {
//   'Access-Control-Allow-Origin': '*',
//   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
// };

// Deno.serve(async (req) => {
//   if (req.method === 'OPTIONS') {
//     return new Response(null, { headers: corsHeaders });
//   }

//   try {
//     const url = new URL(req.url);
//     const code = url.searchParams.get('code');
//     const state = url.searchParams.get('state');
//     const error = url.searchParams.get('error');

//     if (error) {
//       console.error('Reddit OAuth error:', error);
//       return new Response(
//         `<html><body><script>window.close();</script><p>Authentication failed. You can close this window.</p></body></html>`,
//         { headers: { 'Content-Type': 'text/html' } }
//       );
//     }

//     if (!code || !state) {
//       throw new Error('Missing code or state parameter');
//     }

//     const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
//     const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
//     const redditClientId = Deno.env.get('REDDIT_CLIENT_ID')!;
//     const redditClientSecret = Deno.env.get('REDDIT_CLIENT_SECRET')!;
//     const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

//     // Rate limiting check (10 requests per 5 minutes per state/user)
//     const { data: rateLimitCheck } = await supabase.rpc('check_rate_limit', {
//       endpoint_name: 'reddit-oauth-callback',
//       identifier_value: state,
//       max_requests: 10,
//       window_minutes: 5
//     });

//     if (!rateLimitCheck) {
//       console.warn('Rate limit exceeded for Reddit OAuth callback');
//       throw new Error('Too many authentication attempts. Please try again later.');
//     }

//     // Get redirect URI from state or construct it
//     const redirectUri = `${supabaseUrl}/functions/v1/reddit-oauth-callback`;

//     console.log('Exchanging code for access token...');
//     console.log('Redirect URI:', redirectUri);
//     console.log('Client ID:', redditClientId);

//     // Prepare the request body
//     const requestBody = new URLSearchParams({
//       grant_type: 'authorization_code',
//       code: code,
//       redirect_uri: redirectUri,
//     });

//     // Exchange code for access token
//     const tokenResponse = await fetch('https://www.reddit.com/api/v1/access_token', {
//       method: 'POST',
//       headers: {
//         'Authorization': 'Basic ' + btoa(`${redditClientId}:${redditClientSecret}`),
//         'Content-Type': 'application/x-www-form-urlencoded',
//         'User-Agent': 'SocialMediaManager/1.0',
//       },
//       body: requestBody,
//     });

//     console.log('Token response status:', tokenResponse.status);

//     if (!tokenResponse.ok) {
//       const errorText = await tokenResponse.text();
//       console.error('Reddit API Error Response:', errorText);
//       throw new Error('Failed to authenticate with Reddit');
//     }

//     const tokenData = await tokenResponse.json();
//     const accessToken = tokenData.access_token;
//     const refreshToken = tokenData.refresh_token;

//     console.log('Fetching Reddit user data...');

//     // Fetch user data from Reddit
//     const userResponse = await fetch('https://oauth.reddit.com/api/v1/me', {
//       headers: {
//         'Authorization': `Bearer ${accessToken}`,
//         'User-Agent': 'SocialMediaManager/1.0',
//       },
//     });

//     const userData = await userResponse.json();
//     console.log('User data fetched:', userData.name);

//     if (!userResponse.ok || userData.error) {
//       console.error('Failed to fetch Reddit user data:', userData);
//       throw new Error('Failed to retrieve Reddit user information');
//     }

//     // Get user ID from state parameter (passed from frontend)
//     const userId = state.split('_')[1]; // Format: "reddit_{userId}"

//     if (!userId) {
//       throw new Error('Invalid state parameter');
//     }

//     // Check if connection already exists
//     const { data: existingConnection } = await supabase
//       .from('social_connections')
//       .select('id')
//       .eq('user_id', userId)
//       .eq('platform', 'reddit')
//       .eq('platform_user_id', userData.id)
//       .maybeSingle();

//     // Encrypt tokens before storing
//     const encryptedTokens = await encryptTokens({
//       access_token: accessToken,
//       refresh_token: refreshToken,
//     });

//     const connectionData = {
//       user_id: userId,
//       platform: 'reddit',
//       platform_user_id: userData.id,
//       username: userData.name,
//       display_name: userData.name,
//       access_token: encryptedTokens.access_token!,
//       refresh_token: encryptedTokens.refresh_token,
//       profile_image_url: userData.icon_img?.split('?')[0] || null,
//       followers_count: userData.total_karma || 0,
//       profile_data: {
//         link_karma: userData.link_karma,
//         comment_karma: userData.comment_karma,
//         created_utc: userData.created_utc,
//       },
//       is_active: true,
//     };

//     if (existingConnection) {
//       const { error: updateError } = await supabase
//         .from('social_connections')
//         .update(connectionData)
//         .eq('id', existingConnection.id);

//       if (updateError) {
//         console.error('Error updating Reddit connection:', updateError);
//         throw new Error('Failed to save Reddit connection');
//       }
//       console.log('Updated existing Reddit connection');
//     } else {
//       const { error: insertError } = await supabase
//         .from('social_connections')
//         .insert(connectionData);

//       if (insertError) {
//         console.error('Error inserting Reddit connection:', insertError);
//         throw new Error('Failed to save Reddit connection');
//       }
//       console.log('Created new Reddit connection');
//     }

//     // Close the popup and redirect parent to dashboard
//     return new Response(
//       `<html><body><script>
//         window.opener.postMessage({ type: 'reddit-auth-success' }, '*');
//         window.close();
//       </script><p>Authentication successful! Closing window...</p></body></html>`,
//       { headers: { 'Content-Type': 'text/html' } }
//     );
//   } catch (error) {
//     console.error('Error in reddit-oauth-callback:', error);
//     const errorMessage = error instanceof Error ? error.message : 'Unknown error';
//     return new Response(
//       `<html><body><script>
//         window.opener.postMessage({ type: 'reddit-auth-error', error: '${errorMessage}' }, '*');
//         window.close();
//       </script><p>Authentication failed. You can close this window.</p></body></html>`,
//       { headers: { 'Content-Type': 'text/html' } }
//     );
//   }
// });

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import { encryptTokens } from "../_shared/encryption.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function redirectToFrontend(params: Record<string, string>) {
  const FRONTEND_URL = "http://localhost:8080" //Deno.env.get("FRONTEND_URL"); // e.g. https://yourapp.com
  if (!FRONTEND_URL) {
    // If you forget FRONTEND_URL, at least return something readable
    return new Response("Missing FRONTEND_URL env var", { status: 500 });
  }

  const dest = new URL(`${FRONTEND_URL}/oauth/reddit/complete`);
  for (const [k, v] of Object.entries(params)) dest.searchParams.set(k, v);

  return Response.redirect(dest.toString(), 302);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const oauthError = url.searchParams.get("error");

    // If Reddit returned an error
    if (oauthError) {
      console.error("Reddit OAuth error:", oauthError);
      return redirectToFrontend({
        success: "0",
        error: oauthError,
      });
    }

    if (!code || !state) {
      throw new Error("Missing code or state parameter");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY",
    )!;
    const redditClientId = Deno.env.get("REDDIT_CLIENT_ID")!;
    const redditClientSecret = Deno.env.get("REDDIT_CLIENT_SECRET")!;

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Rate limiting check (10 requests per 5 minutes per state/user)
    const { data: rateLimitCheck, error: rlError } = await supabase.rpc(
      "check_rate_limit",
      {
        endpoint_name: "reddit-oauth-callback",
        identifier_value: state,
        max_requests: 10,
        window_minutes: 5,
      },
    );

    if (rlError) {
      console.error("Rate limit RPC error:", rlError);
      throw new Error("Rate limit check failed");
    }

    if (!rateLimitCheck) {
      throw new Error("Too many authentication attempts. Please try again later.");
    }

    // IMPORTANT: this MUST exactly match what you used in the initial authorize step
    // and what is registered in Reddit app settings.
    const redirectUri = `${supabaseUrl}/functions/v1/reddit-oauth-callback`;

    // Exchange code for access token
    const requestBody = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    });

    const tokenResponse = await fetch(
      "https://www.reddit.com/api/v1/access_token",
      {
        method: "POST",
        headers: {
          Authorization: "Basic " + btoa(`${redditClientId}:${redditClientSecret}`),
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "SocialMediaManager/1.0",
        },
        body: requestBody,
      },
    );

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Reddit token exchange failed:", tokenResponse.status, errorText);
      throw new Error(errorText);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token as string | undefined;
    const refreshToken = tokenData.refresh_token as string | undefined;

    if (!accessToken) {
      console.error("Missing access_token in Reddit response:", tokenData);
      throw new Error("Reddit did not return an access token");
    }

    // Fetch user data from Reddit
    const userResponse = await fetch("https://oauth.reddit.com/api/v1/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "SocialMediaManager/1.0",
      },
    });

    const userData = await userResponse.json();

    if (!userResponse.ok || userData?.error) {
      console.error("Failed to fetch Reddit user data:", userData);
      throw new Error("Failed to retrieve Reddit user information");
    }

    // Parse userId out of state (your format: "reddit_{userId}")
    const parts = state.split("_");
    const userId = parts[1];

    if (!userId) {
      throw new Error("Invalid state parameter");
    }

    // Check if connection already exists
    const { data: existingConnection, error: existingErr } = await supabase
      .from("social_connections")
      .select("id")
      .eq("user_id", userId)
      .eq("platform", "reddit")
      .eq("platform_user_id", userData.id)
      .maybeSingle();

    if (existingErr) {
      console.error("Error checking existing connection:", existingErr);
      throw new Error("Failed to check existing connection");
    }

    // Encrypt tokens
    const encryptedTokens = await encryptTokens({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    const connectionData = {
      user_id: userId,
      platform: "reddit",
      platform_user_id: userData.id,
      username: userData.name,
      display_name: userData.name,
      access_token: encryptedTokens.access_token!,
      refresh_token: encryptedTokens.refresh_token ?? null,
      profile_image_url: userData.icon_img?.split("?")[0] || null,
      followers_count: userData.total_karma || 0,
      profile_data: {
        link_karma: userData.link_karma,
        comment_karma: userData.comment_karma,
        created_utc: userData.created_utc,
      },
      is_active: true,
    };

    if (existingConnection?.id) {
      const { error: updateError } = await supabase
        .from("social_connections")
        .update(connectionData)
        .eq("id", existingConnection.id);

      if (updateError) {
        console.error("Error updating Reddit connection:", updateError);
        throw new Error("Failed to save Reddit connection");
      }
    } else {
      const { error: insertError } = await supabase
        .from("social_connections")
        .insert(connectionData);

      if (insertError) {
        console.error("Error inserting Reddit connection:", insertError);
        throw new Error("Failed to save Reddit connection");
      }
    }

    // Success -> redirect to frontend complete page
    return redirectToFrontend({
      success: "1",
      platform: "reddit",
    });
  } catch (error) {
    console.error("Error in reddit-oauth-callback:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return redirectToFrontend({
      success: "0",
      error: msg,
    });
  }
});
