import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { decryptTokens, encryptTokens } from "../_shared/encryption.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Function to refresh Reddit access token
async function refreshRedditToken(supabase: any, connection: any) {
  const redditClientId = Deno.env.get('REDDIT_CLIENT_ID')!;
  const redditClientSecret = Deno.env.get('REDDIT_CLIENT_SECRET')!;

  console.log('Refreshing Reddit access token...');

  // Decrypt the refresh token before use
  const decryptedTokens = await decryptTokens({
    refresh_token: connection.refresh_token,
  });

  const tokenResponse = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + btoa(`${redditClientId}:${redditClientSecret}`),
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'SocialMediaManager/1.0',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: decryptedTokens.refresh_token!,
    }),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error('Token refresh failed:', errorText);
    throw new Error('Failed to refresh authentication');
  }

  const tokenData = await tokenResponse.json();
  const newAccessToken = tokenData.access_token;

  // Encrypt new access token before storing
  const encryptedTokens = await encryptTokens({
    access_token: newAccessToken,
  });

  // Update the connection with new encrypted access token
  const { error: updateError } = await supabase
    .from('social_connections')
    .update({ 
      access_token: encryptedTokens.access_token,
      updated_at: new Date().toISOString(),
    })
    .eq('id', connection.id);

  if (updateError) {
    console.error('Failed to update access token:', updateError);
    throw new Error('Failed to update authentication');
  }

  console.log('Access token refreshed successfully');
  return newAccessToken;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const body = await req.json();

    // Check for internal service role call
    let userId: string;
    if (body._internal_user_id) {
      const authHeader = req.headers.get('Authorization');
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      
      if (!authHeader || !authHeader.includes(serviceRoleKey!)) {
        throw new Error('Unauthorized service role call');
      }
      
      userId = body._internal_user_id;
      console.log('Service role call for user:', userId);
    } else {
      // Get authenticated user
      const authHeader = req.headers.get('Authorization')!;
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);

      if (authError || !user) {
        throw new Error('Unauthorized');
      }
      userId = user.id;
    }

    // Validate request body with Zod
    const RedditPostSchema = z.object({
      content: z.string().max(40000, 'Content cannot exceed 40000 characters').optional(),
      connectionId: z.string().uuid('Invalid connection ID format'),
      title: z.string().min(1, 'Title is required').max(300, 'Title cannot exceed 300 characters'),
      mediaUrls: z.array(z.string().url().regex(/^https?:\/\//, 'URL must use http or https protocol')).optional(),
      _internal_user_id: z.string().uuid().optional(),
    }).refine(
      (data) => data.content || (data.mediaUrls && data.mediaUrls.length > 0),
      { message: 'Either content or media is required' }
    );

    const validationResult = RedditPostSchema.safeParse(body);
    
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      throw new Error(`Validation failed: ${errors}`);
    }

    const { content, connectionId, title, mediaUrls } = validationResult.data;

    // Get the connection details
    const { data: connection, error: connectionError } = await supabase
      .from('social_connections')
      .select('*')
      .eq('id', connectionId)
      .eq('user_id', userId)
      .eq('platform', 'reddit')
      .single();

    if (connectionError || !connection) {
      throw new Error('Reddit connection not found');
    }

    // Refresh the access token to ensure it's valid
    let accessToken = connection.access_token;
    try {
      accessToken = await refreshRedditToken(supabase, connection);
    } catch (refreshError) {
      console.error('Failed to refresh token:', refreshError);
      throw new Error('Reddit authentication expired. Please reconnect your Reddit account.');
    }

    // Post to user's own profile using u_username format
    const userProfileSubreddit = `u_${connection.username}`;
    
    console.log('Posting to Reddit...');
    console.log('Profile subreddit:', userProfileSubreddit);
    console.log('Title:', title);
    console.log('Content length:', content?.length || 0);

    // Prepare post parameters based on content type
    let postParams: Record<string, string> = {
      sr: userProfileSubreddit,
      title: title,
      api_type: 'json',
    };

    if (mediaUrls && mediaUrls.length > 0) {
      let mediaUrl = mediaUrls[0];
      console.log('Creating Reddit post with embedded image');
      
      if (mediaUrl.includes('/storage/v1/object/')) {
        const pathMatch = mediaUrl.match(/\/post-videos\/(.+?)(?:\?|$)/);
        if (pathMatch) {
          const filePath = decodeURIComponent(pathMatch[1]);
          console.log('Generating signed URL for Reddit post, path:', filePath);
          const { data: signedUrlData, error: signedError } = await supabase.storage
            .from('post-videos')
            .createSignedUrl(filePath, 86400);
          
          if (signedError || !signedUrlData?.signedUrl) {
            throw new Error('Failed to generate signed URL for media');
          }
          mediaUrl = signedUrlData.signedUrl;
          console.log('Using signed URL for Reddit post');
        }
      }
      
      postParams.kind = 'self';
      postParams.text = content ? `${content}\n\n![Image](${mediaUrl})` : `![Image](${mediaUrl})`;
      
      console.log('Post will include markdown embedded image');
    } else {
      postParams.kind = 'self';
      postParams.text = content || '';
    }

    const postResponse = await fetch('https://oauth.reddit.com/api/submit', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'SocialMediaManager/1.0',
      },
      body: new URLSearchParams(postParams),
    });

    const responseText = await postResponse.text();
    console.log('Reddit API raw response:', responseText);

    let postData;
    try {
      postData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse Reddit response:', responseText);
      throw new Error(`Reddit API returned invalid response. Status: ${postResponse.status}`);
    }

    console.log('Reddit post response:', JSON.stringify(postData, null, 2));

    if (!postResponse.ok || postData.json?.errors?.length > 0) {
      const errorMsg = postData.json?.errors?.[0]?.[1] || postData.message || 'Failed to post to Reddit';
      console.error('Reddit post failed:', errorMsg);
      throw new Error(errorMsg);
    }

    const postUrl = postData.json?.data?.url || '';
    const postId = postData.json?.data?.id || postData.json?.data?.name || '';

    console.log('Post successful:', postUrl);

    // Save post to database
    const { data: socialPost, error: postError } = await supabase
      .from('social_posts')
      .insert({
        connection_id: connectionId,
        platform_post_id: postId,
        content: content || '',
        post_url: postUrl,
        media_urls: mediaUrls || [],
        posted_at: new Date().toISOString(),
        followers_at_post: connection.followers_count || 0,
        comments_count: 0,
        shares_count: 0,
      })
      .select()
      .single();

    if (postError) {
      console.error('Error saving post to database:', postError);
      throw new Error('Failed to save post record');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        post: socialPost,
        postUrl: postUrl,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in reddit-post:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
